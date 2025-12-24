import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { storage, getResetTime } from "./storage";
import { MAX_CONNECTIONS_PER_DAY, MAX_SESSION_DURATION_MS, type SessionLimitStatus } from "@shared/schema";

// In-memory session storage
interface VoiceSession {
  id: string;
  channelId: string;
  userId: string;
  joinedAt: Date;
  lastActivity: Date;
  expiresAt: number;
  expiryTimeout?: NodeJS.Timeout;
}

const sessions = new Map<string, VoiceSession>();

// Validation schemas
const joinSessionSchema = z.object({
  channelId: z.string().min(1),
  userId: z.string().min(1),
});

// Audio bot validation schemas
const botJoinSchema = z.object({
  appId: z.string().min(1),
  channel: z.string().min(1),
  uid: z.number().int().positive(),
  token: z.string().optional(),
});

const botPlaySchema = z.object({
  file: z.string().min(1),
});

// Audio Bot Manager
interface BotStatus {
  isConnected: boolean;
  isPlaying: boolean;
  channel: string | null;
  uid: number | null;
  currentFile: string | null;
  playbackProgress: number;
  playbackDuration: number;
}

interface BotMessage {
  type: string;
  [key: string]: unknown;
}

class AudioBotManager {
  private process: ChildProcess | null = null;
  private messageBuffer: string = "";
  private pendingCallbacks: Map<string, (data: BotMessage) => void> = new Map();
  private status: BotStatus = {
    isConnected: false,
    isPlaying: false,
    channel: null,
    uid: null,
    currentFile: null,
    playbackProgress: 0,
    playbackDuration: 0,
  };
  private logs: Array<{ timestamp: number; level: string; message: string }> = [];
  private eventHandlers: Array<(msg: BotMessage) => void> = [];
  private sdkAvailable: boolean = false;
  private agoraAvailable: boolean = false;
  private pydubAvailable: boolean = false;
  private lastError: string | null = null;

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  isSdkAvailable(): boolean {
    return this.sdkAvailable;
  }

  isAgoraAvailable(): boolean {
    return this.agoraAvailable;
  }

  isPydubAvailable(): boolean {
    return this.pydubAvailable;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getStatus(): BotStatus {
    return { ...this.status };
  }

  getLogs(limit: number = 50): typeof this.logs {
    return this.logs.slice(-limit);
  }

  onEvent(handler: (msg: BotMessage) => void): void {
    this.eventHandlers.push(handler);
  }

  async start(): Promise<boolean> {
    if (this.isRunning()) {
      return true;
    }

    return new Promise((resolve) => {
      const pythonScript = path.join(process.cwd(), "server", "python", "audio_bot.py");
      
      if (!fs.existsSync(pythonScript)) {
        console.error("Python bot script not found:", pythonScript);
        this.lastError = "Python bot script not found";
        resolve(false);
        return;
      }

      let resolved = false;
      const resolveOnce = (value: boolean) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.eventHandlers = this.eventHandlers.filter(h => h !== readyHandler);
          resolve(value);
        }
      };

      this.process = spawn("python3", [pythonScript], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd(),
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        this.handleOutput(data.toString());
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        console.error("Bot stderr:", data.toString());
      });

      this.process.on("close", (code) => {
        console.log("Bot process exited with code:", code);
        this.process = null;
        this.status.isConnected = false;
        this.status.isPlaying = false;
        
        // If process closed before we resolved, treat as failure
        // Only set generic error if no specific error was already captured
        if (!resolved) {
          this.sdkAvailable = false;
          if (!this.lastError) {
            this.lastError = `Bot process exited with code ${code} - Agora Python SDK may not be properly installed`;
          }
          resolveOnce(false);
        }
      });

      this.process.on("error", (err) => {
        console.error("Bot process error:", err);
        this.process = null;
        this.lastError = `Bot process error: ${err.message}`;
        resolveOnce(false);
      });

      // Wait for ready signal with timeout
      const timeout = setTimeout(() => {
        this.lastError = "Bot process failed to start within timeout";
        if (this.process) {
          this.process.kill();
          this.process = null;
        }
        resolveOnce(false);
      }, 10000);

      const readyHandler = (msg: BotMessage) => {
        if (msg.type === "ready") {
          // Capture all diagnostic fields from Python bot
          this.sdkAvailable = msg.sdk_available === true;
          this.agoraAvailable = msg.agora_available === true;
          this.pydubAvailable = msg.pydub_available === true;
          
          if (!this.sdkAvailable) {
            // Use the actual error from Python bot if available, with a fallback
            const botError = msg.error as string | undefined;
            this.lastError = botError 
              ? `SDK not available: ${botError}`
              : "Agora Python SDK not available - audio bot features require the agora-python-server-sdk and pydub packages";
            console.error("Bot SDK unavailable:", this.lastError);
            // Terminate the bot process since it's unusable without SDK
            if (this.process) {
              this.process.kill();
              this.process = null;
            }
            resolveOnce(false);
          } else {
            this.lastError = null;
            resolveOnce(true);
          }
        }
      };
      this.eventHandlers.push(readyHandler);
    });
  }

  private handleOutput(data: string): void {
    this.messageBuffer += data;
    const lines = this.messageBuffer.split("\n");
    this.messageBuffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg: BotMessage = JSON.parse(line);
        this.handleMessage(msg);
      } catch (e) {
        console.error("Failed to parse bot message:", line);
      }
    }
  }

  private handleMessage(msg: BotMessage): void {
    // Update status based on message type
    switch (msg.type) {
      case "status":
        if (msg.status === "connected") {
          this.status.isConnected = true;
          this.status.channel = msg.channel as string;
          this.status.uid = msg.uid as number;
        } else if (msg.status === "disconnected") {
          this.status.isConnected = false;
          this.status.channel = null;
          this.status.uid = null;
        }
        break;
      case "playback_started":
        this.status.isPlaying = true;
        this.status.currentFile = msg.file as string;
        this.status.playbackDuration = msg.duration as number;
        this.status.playbackProgress = 0;
        break;
      case "progress":
        this.status.playbackProgress = msg.current as number;
        break;
      case "playback_complete":
      case "playback_stopped":
        this.status.isPlaying = false;
        this.status.currentFile = null;
        this.status.playbackProgress = 0;
        break;
      case "log":
        this.logs.push({
          timestamp: msg.timestamp as number,
          level: msg.level as string,
          message: msg.message as string,
        });
        if (this.logs.length > 200) {
          this.logs = this.logs.slice(-100);
        }
        break;
      case "status_response":
        this.status = {
          isConnected: msg.is_connected as boolean,
          isPlaying: msg.is_playing as boolean,
          channel: msg.channel as string | null,
          uid: msg.uid as number | null,
          currentFile: msg.current_file as string | null,
          playbackProgress: msg.playback_progress as number,
          playbackDuration: msg.playback_duration as number,
        };
        break;
    }

    // Call pending callbacks for response types
    const responseType = msg.type;
    if (responseType.endsWith("_response")) {
      const callback = this.pendingCallbacks.get(responseType);
      if (callback) {
        this.pendingCallbacks.delete(responseType);
        callback(msg);
      }
    }

    // Notify event handlers
    for (const handler of this.eventHandlers) {
      try {
        handler(msg);
      } catch (e) {
        console.error("Event handler error:", e);
      }
    }
  }

  private sendCommand(command: object): boolean {
    if (!this.process?.stdin) {
      return false;
    }
    try {
      this.process.stdin.write(JSON.stringify(command) + "\n");
      return true;
    } catch (e) {
      console.error("Failed to send command:", e);
      return false;
    }
  }

  private async sendCommandWithResponse(
    command: object,
    responseType: string,
    timeoutMs: number = 30000
  ): Promise<BotMessage | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete(responseType);
        resolve(null);
      }, timeoutMs);

      this.pendingCallbacks.set(responseType, (msg) => {
        clearTimeout(timeout);
        resolve(msg);
      });

      if (!this.sendCommand(command)) {
        clearTimeout(timeout);
        this.pendingCallbacks.delete(responseType);
        resolve(null);
      }
    });
  }

  async initialize(appId: string): Promise<boolean> {
    const response = await this.sendCommandWithResponse(
      { command: "init", appId },
      "init_response"
    );
    return response?.success === true;
  }

  async joinChannel(channel: string, uid: number, token: string = ""): Promise<boolean> {
    const response = await this.sendCommandWithResponse(
      { command: "join", channel, uid, token },
      "join_response"
    );
    return response?.success === true;
  }

  async leaveChannel(): Promise<boolean> {
    const response = await this.sendCommandWithResponse(
      { command: "leave" },
      "leave_response"
    );
    return response?.success === true;
  }

  async playAudio(filePath: string): Promise<boolean> {
    const response = await this.sendCommandWithResponse(
      { command: "play", file: filePath },
      "play_response"
    );
    return response?.success === true;
  }

  async stopPlayback(): Promise<boolean> {
    const response = await this.sendCommandWithResponse(
      { command: "stop" },
      "stop_response"
    );
    return response?.success === true;
  }

  async shutdown(): Promise<void> {
    if (this.process) {
      await this.sendCommandWithResponse({ command: "quit" }, "quit_response", 5000);
      this.process.kill();
      this.process = null;
    }
  }
}

// Global bot manager instance
const audioBotManager = new AudioBotManager();

// Uploaded files storage
const uploadedFiles = new Map<string, { path: string; originalName: string; uploadedAt: Date }>();
const uploadDir = path.join(os.tmpdir(), "agora-audio-uploads");

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Simple auth session storage with expiry
interface AuthSession {
  token: string;
  createdAt: number;
}
const authSessions = new Map<string, AuthSession>();
const AUTH_SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Auth middleware to protect routes
function requireAuth(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const session = authSessions.get(token);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  
  // Check if session expired
  if (Date.now() - session.createdAt > AUTH_SESSION_TTL) {
    authSessions.delete(token);
    return res.status(401).json({ error: "Session expired" });
  }
  
  next();
}

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of authSessions.entries()) {
    if (now - session.createdAt > AUTH_SESSION_TTL) {
      authSessions.delete(token);
    }
  }
}, 60 * 60 * 1000); // Every hour

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ============================================
  // Authentication Endpoints (public)
  // ============================================

  // Login endpoint
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    
    const validEmail = process.env.LOGIN_EMAIL;
    const validPassword = process.env.LOGIN_PASSWORD;
    
    if (!validEmail || !validPassword) {
      res.status(500).json({ error: "Authentication not configured" });
      return;
    }
    
    if (email === validEmail && password === validPassword) {
      const token = crypto.randomUUID();
      authSessions.set(token, { token, createdAt: Date.now() });
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Verify auth token
  app.get("/api/auth/verify", (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token && authSessions.has(token)) {
      const session = authSessions.get(token);
      if (session && Date.now() - session.createdAt <= AUTH_SESSION_TTL) {
        res.json({ authenticated: true });
      } else {
        authSessions.delete(token);
        res.status(401).json({ authenticated: false });
      }
    } else {
      res.status(401).json({ authenticated: false });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      authSessions.delete(token);
    }
    res.json({ success: true });
  });

  // ============================================
  // Protected Routes (require authentication)
  // ============================================

  // Fetch VC credentials from external API (protected)
  app.post("/api/vc/fetch-credentials", requireAuth, async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }

    try {
      const response = await fetch("https://evilplanet.botpanels.live/api/jack/fetch-vc-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      
      if (data.success && data.credentials) {
        res.json({
          success: true,
          credentials: {
            channel: data.credentials.channel,
            token: data.credentials.token,
            appId: process.env.AGORA_APP_ID || data.credentials.appId,
            userId: process.env.AGORA_USER_ID || "12345",
            clubName: data.credentials.clubName,
          },
        });
      } else {
        res.status(400).json({ error: data.message || "Failed to fetch credentials" });
      }
    } catch (error) {
      console.error("Failed to fetch VC credentials:", error);
      res.status(500).json({ error: "Failed to connect to credentials server" });
    }
  });

  // Health check endpoint (public)
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      activeSessions: sessions.size,
    });
  });

  // Get current limit status (protected)
  app.get("/api/sessions/limits", requireAuth, async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "") || "default";
    const usage = await storage.getDailyUsage(token);
    
    const limitStatus: SessionLimitStatus = {
      remainingConnections: Math.max(0, MAX_CONNECTIONS_PER_DAY - usage.count),
      maxConnectionsPerDay: MAX_CONNECTIONS_PER_DAY,
      usedToday: usage.count,
      resetAt: getResetTime(),
    };
    
    res.json(limitStatus);
  });

  // Create a new voice session (protected)
  app.post("/api/sessions", requireAuth, async (req, res) => {
    try {
      const data = joinSessionSchema.parse(req.body);
      const token = req.headers.authorization?.replace("Bearer ", "") || "default";
      
      // Check daily usage limit
      const usage = await storage.getDailyUsage(token);
      if (usage.count >= MAX_CONNECTIONS_PER_DAY) {
        const limitStatus: SessionLimitStatus = {
          remainingConnections: 0,
          maxConnectionsPerDay: MAX_CONNECTIONS_PER_DAY,
          usedToday: usage.count,
          resetAt: getResetTime(),
        };
        res.status(429).json({ 
          error: "Daily connection limit reached",
          limits: limitStatus,
        });
        return;
      }
      
      const sessionId = crypto.randomUUID();
      const now = Date.now();
      const expiresAt = now + MAX_SESSION_DURATION_MS;
      
      const session: VoiceSession = {
        id: sessionId,
        channelId: data.channelId,
        userId: data.userId,
        joinedAt: new Date(),
        lastActivity: new Date(),
        expiresAt,
      };
      
      // Set auto-expiry timeout
      session.expiryTimeout = setTimeout(() => {
        console.log(`Session ${sessionId} expired after 5 minutes`);
        sessions.delete(sessionId);
      }, MAX_SESSION_DURATION_MS);
      
      sessions.set(sessionId, session);
      
      // Increment usage count
      const updatedUsage = await storage.incrementDailyUsage(token);
      
      const limitStatus: SessionLimitStatus = {
        remainingConnections: Math.max(0, MAX_CONNECTIONS_PER_DAY - updatedUsage.count),
        maxConnectionsPerDay: MAX_CONNECTIONS_PER_DAY,
        usedToday: updatedUsage.count,
        resetAt: getResetTime(),
        sessionExpiresAt: expiresAt,
        sessionRemainingMs: MAX_SESSION_DURATION_MS,
      };
      
      res.status(201).json({
        sessionId,
        channelId: session.channelId,
        userId: session.userId,
        joinedAt: session.joinedAt.toISOString(),
        limits: limitStatus,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Update session activity (heartbeat) (protected)
  app.post("/api/sessions/:sessionId/heartbeat", requireAuth, (req, res) => {
    const { sessionId } = req.params;
    
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    
    session.lastActivity = new Date();
    sessions.set(sessionId, session);
    
    res.json({ 
      status: "ok", 
      lastActivity: session.lastActivity.toISOString() 
    });
  });

  // End a voice session (protected)
  app.delete("/api/sessions/:sessionId", requireAuth, (req, res) => {
    const { sessionId } = req.params;
    
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    
    // Clear the expiry timeout
    if (session.expiryTimeout) {
      clearTimeout(session.expiryTimeout);
    }
    
    sessions.delete(sessionId);
    res.json({ status: "ended", sessionId });
  });

  // Get active sessions for a channel (protected)
  app.get("/api/channels/:channelId/sessions", requireAuth, (req, res) => {
    const { channelId } = req.params;
    
    const channelSessions = Array.from(sessions.values())
      .filter(s => s.channelId === channelId)
      .map(s => ({
        sessionId: s.id,
        userId: s.userId,
        joinedAt: s.joinedAt.toISOString(),
        lastActivity: s.lastActivity.toISOString(),
      }));
    
    res.json({ 
      channelId, 
      sessions: channelSessions,
      count: channelSessions.length,
    });
  });

  // Get session details (protected)
  app.get("/api/sessions/:sessionId", requireAuth, (req, res) => {
    const { sessionId } = req.params;
    
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    
    res.json({
      sessionId: session.id,
      channelId: session.channelId,
      userId: session.userId,
      joinedAt: session.joinedAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      duration: Date.now() - session.joinedAt.getTime(),
    });
  });

  // Cleanup stale sessions (sessions with no activity for 5 minutes)
  setInterval(() => {
    const staleThreshold = Date.now() - 5 * 60 * 1000;
    for (const [id, session] of sessions.entries()) {
      if (session.lastActivity.getTime() < staleThreshold) {
        sessions.delete(id);
      }
    }
  }, 60 * 1000); // Run cleanup every minute

  // ============================================
  // Audio Bot API Endpoints
  // ============================================

  // Upload audio file (protected)
  app.post("/api/audio/upload", requireAuth, async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on("end", () => {
        const buffer = Buffer.concat(chunks);
        
        if (buffer.length === 0) {
          res.status(400).json({ error: "No file data received" });
          return;
        }

        // Generate unique file ID
        const fileId = crypto.randomUUID();
        const contentType = req.headers["content-type"] || "";
        const originalName = req.headers["x-filename"] as string || `audio-${fileId}`;
        
        // Determine file extension
        let ext = ".mp3";
        if (contentType.includes("wav")) ext = ".wav";
        else if (contentType.includes("ogg")) ext = ".ogg";
        else if (originalName.includes(".")) {
          const parts = originalName.split(".");
          ext = "." + parts[parts.length - 1];
        }

        const filePath = path.join(uploadDir, `${fileId}${ext}`);
        
        fs.writeFileSync(filePath, buffer);
        
        uploadedFiles.set(fileId, {
          path: filePath,
          originalName,
          uploadedAt: new Date(),
        });

        res.status(201).json({
          fileId,
          originalName,
          size: buffer.length,
          path: filePath,
        });
      });

      req.on("error", (err) => {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed" });
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // List uploaded files (protected)
  app.get("/api/audio/files", requireAuth, (req, res) => {
    const files = Array.from(uploadedFiles.entries()).map(([id, file]) => ({
      fileId: id,
      originalName: file.originalName,
      uploadedAt: file.uploadedAt.toISOString(),
    }));
    res.json({ files });
  });

  // Delete uploaded file (protected)
  app.delete("/api/audio/files/:fileId", requireAuth, (req, res) => {
    const { fileId } = req.params;
    const file = uploadedFiles.get(fileId);
    
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      uploadedFiles.delete(fileId);
      res.json({ status: "deleted", fileId });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Start the audio bot process (protected)
  app.post("/api/bot/start", requireAuth, async (req, res) => {
    try {
      if (audioBotManager.isRunning()) {
        res.json({ status: "already_running", sdkAvailable: audioBotManager.isSdkAvailable() });
        return;
      }

      const success = await audioBotManager.start();
      
      if (success) {
        res.json({ status: "started", sdkAvailable: true });
      } else {
        const errorMsg = audioBotManager.getLastError() || "Failed to start bot";
        res.status(503).json({ error: errorMsg, sdkAvailable: audioBotManager.isSdkAvailable() });
      }
    } catch (error) {
      console.error("Start bot error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Join a channel with the bot (protected)
  app.post("/api/bot/join", requireAuth, async (req, res) => {
    try {
      const data = botJoinSchema.parse(req.body);
      
      // Start bot if not running
      if (!audioBotManager.isRunning()) {
        const started = await audioBotManager.start();
        if (!started) {
          const errorMsg = audioBotManager.getLastError() || "Failed to start bot process";
          res.status(500).json({ error: errorMsg });
          return;
        }
      }

      // Check if SDK is available before proceeding
      if (!audioBotManager.isSdkAvailable()) {
        const errorMsg = audioBotManager.getLastError() || "Agora Python SDK not available";
        res.status(503).json({ error: errorMsg });
        return;
      }

      // Initialize with app ID
      const initialized = await audioBotManager.initialize(data.appId);
      if (!initialized) {
        res.status(500).json({ error: "Failed to initialize Agora SDK" });
        return;
      }

      // Join channel
      const joined = await audioBotManager.joinChannel(
        data.channel,
        data.uid,
        data.token || ""
      );

      if (joined) {
        res.json({ 
          status: "joined",
          channel: data.channel,
          uid: data.uid,
        });
      } else {
        res.status(500).json({ error: "Failed to join channel" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Join error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Leave channel (protected)
  app.post("/api/bot/leave", requireAuth, async (req, res) => {
    try {
      const success = await audioBotManager.leaveChannel();
      res.json({ status: success ? "left" : "failed" });
    } catch (error) {
      console.error("Leave error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Play audio file (protected)
  app.post("/api/bot/play", requireAuth, async (req, res) => {
    try {
      const data = botPlaySchema.parse(req.body);
      
      // Check if file exists
      let filePath = data.file;
      
      // If it's a file ID, resolve to actual path
      const uploadedFile = uploadedFiles.get(data.file);
      if (uploadedFile) {
        filePath = uploadedFile.path;
      }

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: "Audio file not found" });
        return;
      }

      const status = audioBotManager.getStatus();
      if (!status.isConnected) {
        res.status(400).json({ error: "Bot not connected to a channel" });
        return;
      }

      const success = await audioBotManager.playAudio(filePath);
      
      if (success) {
        res.json({ status: "playing", file: filePath });
      } else {
        res.status(500).json({ error: "Failed to start playback" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Play error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Stop playback (protected)
  app.post("/api/bot/stop", requireAuth, async (req, res) => {
    try {
      const success = await audioBotManager.stopPlayback();
      res.json({ status: success ? "stopped" : "failed" });
    } catch (error) {
      console.error("Stop error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get bot status (protected)
  app.get("/api/bot/status", requireAuth, (req, res) => {
    res.json({
      isRunning: audioBotManager.isRunning(),
      sdkAvailable: audioBotManager.isSdkAvailable(),
      agoraAvailable: audioBotManager.isAgoraAvailable(),
      pydubAvailable: audioBotManager.isPydubAvailable(),
      lastError: audioBotManager.getLastError(),
      ...audioBotManager.getStatus(),
    });
  });

  // Get bot logs (protected)
  app.get("/api/bot/logs", requireAuth, (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({ logs: audioBotManager.getLogs(limit) });
  });

  // Shutdown bot (protected)
  app.post("/api/bot/shutdown", requireAuth, async (req, res) => {
    try {
      await audioBotManager.shutdown();
      res.json({ status: "shutdown" });
    } catch (error) {
      console.error("Shutdown error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================
  // Saved Channels API Endpoints
  // ============================================

  const savedChannelsFile = path.join(process.cwd(), "data", "saved-channels.json");
  const dataDir = path.join(process.cwd(), "data");

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Helper to read saved channels
  function readSavedChannels(): Array<{
    id: string;
    name: string;
    appId: string;
    channelId: string;
    userId: string;
    token?: string;
    createdAt: string;
    updatedAt: string;
  }> {
    try {
      if (fs.existsSync(savedChannelsFile)) {
        const data = fs.readFileSync(savedChannelsFile, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error reading saved channels:", error);
    }
    return [];
  }

  // Helper to write saved channels
  function writeSavedChannels(channels: Array<{
    id: string;
    name: string;
    appId: string;
    channelId: string;
    userId: string;
    token?: string;
    createdAt: string;
    updatedAt: string;
  }>): boolean {
    try {
      fs.writeFileSync(savedChannelsFile, JSON.stringify(channels, null, 2));
      return true;
    } catch (error) {
      console.error("Error writing saved channels:", error);
      return false;
    }
  }

  // Import saved channel schemas from shared (reuse shared schema)
  const createChannelSchema = z.object({
    name: z.string().min(1, "Channel name is required"),
    appId: z.string().min(1, "App ID is required"),
    channelId: z.string().min(1, "Channel ID is required"),
    userId: z.string().min(1, "User ID is required"),
    token: z.string().optional(),
  });

  const updateChannelSchema = createChannelSchema.partial();

  // Get all saved channels (protected)
  app.get("/api/channels/saved", requireAuth, (req, res) => {
    const channels = readSavedChannels();
    res.json({ channels });
  });

  // Get a single saved channel (protected)
  app.get("/api/channels/saved/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const channels = readSavedChannels();
    const channel = channels.find(c => c.id === id);
    
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    
    res.json(channel);
  });

  // Create a new saved channel (protected)
  app.post("/api/channels/saved", requireAuth, (req, res) => {
    try {
      const data = createChannelSchema.parse(req.body);
      const channels = readSavedChannels();
      
      const newChannel = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      channels.push(newChannel);
      
      if (writeSavedChannels(channels)) {
        res.status(201).json(newChannel);
      } else {
        res.status(500).json({ error: "Failed to save channel" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Create channel error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Update a saved channel (protected)
  app.put("/api/channels/saved/:id", requireAuth, (req, res) => {
    try {
      const { id } = req.params;
      const data = updateChannelSchema.parse(req.body);
      const channels = readSavedChannels();
      
      const index = channels.findIndex(c => c.id === id);
      if (index === -1) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }
      
      channels[index] = {
        ...channels[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      
      if (writeSavedChannels(channels)) {
        res.json(channels[index]);
      } else {
        res.status(500).json({ error: "Failed to update channel" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Update channel error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Delete a saved channel (protected)
  app.delete("/api/channels/saved/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const channels = readSavedChannels();
    
    const index = channels.findIndex(c => c.id === id);
    if (index === -1) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    
    channels.splice(index, 1);
    
    if (writeSavedChannels(channels)) {
      res.json({ status: "deleted", id });
    } else {
      res.status(500).json({ error: "Failed to delete channel" });
    }
  });

  return httpServer;
}

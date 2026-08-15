import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { getRecentClubs, addRecentClub, deleteRecentClub } from "./recent-clubs";
import { getUsers, addUser, deleteUser, verifyLogin, type UserRole } from "./users";
import { checkClub as checkVoiceFirewall, addClub as addFirewallClub, removeClub as removeFirewallClub, listClubs as listFirewallClubs } from "./voice-firewall";

const PLAYER_API_URL = process.env.PLAYER_API_URL || "https://playerapi.xorbots.live";
const PLAYER_API_KEY = process.env.PLAYER_API_KEY || "xVsQMpjTdgnZ6nw0p73fI_J_9CkXmDRjUNtAKHgnmKY";

// In-memory session storage
interface VoiceSession {
  id: string;
  channelId: string;
  userId: string;
  joinedAt: Date;
  lastActivity: Date;
}

const sessions = new Map<string, VoiceSession>();

// Validation schemas
const joinSessionSchema = z.object({
  channelId: z.string().min(1),
  userId: z.string().min(1),
});


// Simple auth session storage with expiry
interface AuthSession {
  token: string;
  createdAt: number;
  userId: string;
  role: UserRole;
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

  req.authUserId = session.userId;
  req.authRole = session.role;
  next();
}

// Admin-only middleware, used after requireAuth
function requireAdmin(req: any, res: any, next: any) {
  if (req.authRole !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  Array.from(authSessions.entries()).forEach(([token, session]) => {
    if (now - session.createdAt > AUTH_SESSION_TTL) {
      authSessions.delete(token);
    }
  });
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

    if (!email || !password) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (getUsers().length === 0) {
      res.status(500).json({ error: "Authentication not configured" });
      return;
    }

    const user = verifyLogin(email, password);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = crypto.randomUUID();
    authSessions.set(token, { token, createdAt: Date.now(), userId: user.id, role: user.role });
    res.json({ success: true, token, role: user.role });
  });

  // Verify auth token
  app.get("/api/auth/verify", (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token && authSessions.has(token)) {
      const session = authSessions.get(token);
      if (session && Date.now() - session.createdAt <= AUTH_SESSION_TTL) {
        res.json({ authenticated: true, role: session.role });
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

  // Fetch VC credentials from external API with fallback URLs (protected)
  app.post("/api/vc/fetch-credentials", requireAuth, async (req: any, res) => {
    const { code, bypassFirewall } = req.body;

    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }

    // Check if code is exempted
    const exemptedPath = path.join(process.cwd(), "data", "exempted-codes.json");
    try {
      const exemptedData = fs.readFileSync(exemptedPath, "utf-8");
      const exemptedConfig = JSON.parse(exemptedData);
      if (exemptedConfig.codes && exemptedConfig.codes.includes(code.trim())) {
        console.log(`Code "${code}" is exempted, blocking request`);
        res.status(500).json({ error: "Failed to connect to any credentials server" });
        return;
      }
    } catch (error) {
      // If file doesn't exist or can't be read, continue normally
    }

    // Check the voice firewall (admins can opt to bypass this check)
    const wantsFirewallBypass = bypassFirewall === true && req.authRole === "admin";
    if (!wantsFirewallBypass) {
      const firewallResult = await checkVoiceFirewall(code.trim());
      if (firewallResult?.blocked) {
        console.log(`Code "${code}" is voice-firewall protected, blocking request`);
        if (req.authRole === "admin") {
          res.status(403).json({ error: `Club ${code} is protected by the voice firewall` });
        } else {
          res.status(500).json({ error: "Failed to connect to any credentials server" });
        }
        return;
      }
      // If firewallResult is null (service unreachable), fail open and continue,
      // matching the exempted-codes behavior above.
    }

    // Load panels from JSON file
    const panelsPath = path.join(process.cwd(), "data", "panels.json");
    let servers: { url: string; userId: string }[] = [];
    
    try {
      const panelsData = fs.readFileSync(panelsPath, "utf-8");
      const panelsConfig = JSON.parse(panelsData);
      servers = panelsConfig.panels.map((panel: { url: string; userId: string }) => ({
        url: panel.url,
        userId: panel.userId === "ENV_AGORA_USER_ID" 
          ? (process.env.AGORA_USER_ID || "12345") 
          : panel.userId,
      }));
    } catch (error) {
      console.error("Failed to load panels.json, using defaults:", error);
      servers = [
        { url: "https://evil2.botpanels.live", userId: "MJUL6435" },
      ];
    }
    
    const endpoint = "/api/vc/fetch-credentials";
    let lastError: Error | null = null;

    for (const server of servers) {
      const baseUrl = server.url;
      try {
        console.log(`Trying credentials fetch from: ${baseUrl}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        // If server didn't respond with OK status, try next URL
        if (!response.ok) {
          console.log(`Server ${baseUrl} returned status ${response.status}, trying next...`);
          lastError = new Error(`Server returned ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        if (data.success && data.credentials) {
          const credentials = {
            channel: data.credentials.channel,
            token: data.credentials.token,
            appId: process.env.AGORA_APP_ID || data.credentials.appId,
            userId: data.credentials.userId || server.userId,
            clubName: data.credentials.clubName,
          };
          
          // Track this club in the recent clubs list (code + name only)
          addRecentClub(req.authUserId, {
            code,
            clubName: credentials.clubName,
          });
          
          console.log(`Successfully fetched credentials from: ${baseUrl}`);
          res.json({
            success: true,
            credentials,
          });
          return;
        } else {
          // Server responded but no valid credentials - try next URL
          console.log(`No valid credentials from ${baseUrl}, trying next...`);
          lastError = new Error(data.message || "No valid credentials");
          continue;
        }
      } catch (error) {
        console.error(`Failed to fetch from ${baseUrl}:`, error);
        lastError = error as Error;
        // Continue to next URL
      }
    }

    // All URLs failed
    console.error("All credential servers failed:", lastError);
    res.status(500).json({ error: "Failed to connect to any credentials server" });
  });

  // Health check endpoint (public)
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      activeSessions: sessions.size,
    });
  });

  // Get fixed Agora config (App ID and User ID from environment)
  app.get("/api/config/agora", requireAuth, (req, res) => {
    res.json({
      appId: process.env.AGORA_APP_ID || "",
      userId: process.env.AGORA_USER_ID || "",
    });
  });

  // Get recent clubs (last 15, code + name only, per user)
  app.get("/api/clubs/recent", requireAuth, (req: any, res) => {
    const clubs = getRecentClubs(req.authUserId);
    res.json({ clubs });
  });

  // Delete a recent club
  app.delete("/api/clubs/recent/:code", requireAuth, (req: any, res) => {
    const { code } = req.params;
    const deleted = deleteRecentClub(req.authUserId, decodeURIComponent(code));
    res.json({ success: deleted });
  });

  // ============================================
  // User Management (admin only)
  // ============================================

  const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["admin", "user"]),
  });

  // List users (admin only)
  app.get("/api/users", requireAuth, requireAdmin, (req, res) => {
    res.json({ users: getUsers() });
  });

  // Add a user (admin only)
  app.post("/api/users", requireAuth, requireAdmin, (req, res) => {
    try {
      const data = createUserSchema.parse(req.body);
      const user = addUser(data);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to add user" });
      }
    }
  });

  // Remove a user (admin only)
  app.delete("/api/users/:id", requireAuth, requireAdmin, (req: any, res) => {
    const { id } = req.params;

    if (id === req.authUserId) {
      res.status(400).json({ error: "You cannot remove your own account" });
      return;
    }

    try {
      deleteUser(id);
      // Invalidate any active sessions belonging to the removed user
      Array.from(authSessions.entries()).forEach(([token, session]) => {
        if (session.userId === id) {
          authSessions.delete(token);
        }
      });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to remove user" });
    }
  });

  // ============================================
  // Voice Firewall (admin only)
  // ============================================

  // Check whether a club is voice-firewall protected
  app.get("/api/firewall/check/:code", requireAuth, requireAdmin, async (req, res) => {
    const { code } = req.params;
    const result = await checkVoiceFirewall(decodeURIComponent(code));
    if (!result) {
      res.status(502).json({ error: "Failed to reach voice firewall service" });
      return;
    }
    res.json(result);
  });

  // List all voice-firewalled clubs
  app.get("/api/firewall", requireAuth, requireAdmin, async (req, res) => {
    try {
      const data = await listFirewallClubs();
      res.json(data);
    } catch (error) {
      res.status(502).json({ error: "Failed to reach voice firewall service" });
    }
  });

  // Add a club to the voice firewall
  app.post("/api/firewall", requireAuth, requireAdmin, async (req, res) => {
    const { club_code, reason } = req.body || {};
    if (!club_code) {
      res.status(400).json({ error: "club_code is required" });
      return;
    }
    const result = await addFirewallClub(String(club_code).trim(), reason ? String(reason).trim() : undefined);
    res.json(result);
  });

  // Remove a club from the voice firewall
  app.delete("/api/firewall/:code", requireAuth, requireAdmin, async (req, res) => {
    const { code } = req.params;
    const result = await removeFirewallClub(decodeURIComponent(code));
    res.json(result);
  });

  // Batch player lookup (name/avatar info) via xorbots player API (protected)
  app.post("/api/players/batch", requireAuth, async (req, res) => {
    const raw = Array.isArray(req.body?.gcs) ? req.body.gcs : [];
    const gcs = Array.from(
      new Set(
        raw
          .map((v: unknown) => String(v).trim())
          .filter((v: string) => v.length > 0)
      )
    );

    if (gcs.length === 0) {
      res.json({ results: [] });
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${PLAYER_API_URL}/players/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PLAYER_API_KEY}`,
        },
        body: JSON.stringify({ gcs }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        res.status(502).json({ error: "Player lookup failed" });
        return;
      }

      const data = await response.json();
      const results = Array.isArray(data) ? data : (data.results ?? []);
      res.json({ results });
    } catch (error) {
      console.error("Player lookup failed:", error);
      res.status(502).json({ error: "Player lookup failed" });
    }
  });

  // Create a new voice session (protected)
  app.post("/api/sessions", requireAuth, async (req, res) => {
    try {
      const data = joinSessionSchema.parse(req.body);

      const sessionId = crypto.randomUUID();

      const session: VoiceSession = {
        id: sessionId,
        channelId: data.channelId,
        userId: data.userId,
        joinedAt: new Date(),
        lastActivity: new Date(),
      };

      sessions.set(sessionId, session);

      res.status(201).json({
        sessionId,
        channelId: session.channelId,
        userId: session.userId,
        joinedAt: session.joinedAt.toISOString(),
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
    Array.from(sessions.entries()).forEach(([id, session]) => {
      if (session.lastActivity.getTime() < staleThreshold) {
        sessions.delete(id);
      }
    });
  }, 60 * 1000); // Run cleanup every minute

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

  // Server restart endpoint (for pm2 auto-restart on external server)
  app.post("/api/server/restart", requireAuth, (_req, res) => {
    res.json({ status: "restarting" });
    // Give time for response to be sent before exiting
    setTimeout(() => {
      console.log("Server restart requested via API");
      process.exit(0);
    }, 100);
  });

  return httpServer;
}

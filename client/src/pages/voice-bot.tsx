import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, Headphones, LogOut, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDisplay } from "@/components/voice-bot/status-display";
import { CodeInput } from "@/components/voice-bot/code-input";
import { UserList } from "@/components/voice-bot/user-list";
import { AudioControls } from "@/components/voice-bot/audio-controls";
import { LogsConsole } from "@/components/voice-bot/logs-console";
import { AlertBanner } from "@/components/voice-bot/alert-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAgora } from "@/hooks/use-agora";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ConnectionStatus, type VoiceConfig } from "@shared/schema";

interface VoiceBotProps {
  onLogout: () => void;
  onConnectionChange?: (connected: boolean) => void;
  isAdmin?: boolean;
}

export default function VoiceBot({ onLogout, onConnectionChange, isAdmin }: VoiceBotProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<VoiceConfig>({
    appId: "",
    channelId: "",
    userId: "",
    token: "",
  });
  const [clubName, setClubName] = useState<string>("");
  const [localUserId, setLocalUserId] = useState<string | number | undefined>();
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const leaveRef = useRef<(() => Promise<void>) | null>(null);
  const pendingJoinRef = useRef<VoiceConfig | null>(null);
  
  const {
    status,
    isMuted,
    remoteUsers,
    networkQuality,
    logs,
    sdkLoaded,
    sdkError,
    join,
    leave,
    clearLogs,
    addLog,
  } = useAgora({
    onVolumeIndicator: (volumes) => {
      const local = volumes.find((v) => v.uid === localUserId);
      if (local) {
        setLocalAudioLevel(local.level);
      }
    },
  });

  const isConnected = status === ConnectionStatus.CONNECTED;
  const isConnecting = status === ConnectionStatus.CONNECTING || status === ConnectionStatus.RECONNECTING;
  const canJoin = sdkLoaded && config.appId && config.channelId && config.userId && !isConnecting && !isConnected;

  useEffect(() => {
    onConnectionChange?.(isConnected);
  }, [isConnected, onConnectionChange]);

  const handleCredentialsFetched = useCallback((credentials: {
    appId: string;
    channel: string;
    token: string;
    userId: string;
    clubName: string;
  }) => {
    const newConfig = {
      appId: credentials.appId,
      channelId: credentials.channel,
      userId: credentials.userId,
      token: credentials.token,
    };
    setConfig(newConfig);
    setClubName(credentials.clubName || "");
    addLog(`Credentials fetched for ${credentials.clubName || "channel"}`, "success");
    
    pendingJoinRef.current = newConfig;
  }, [addLog]);

  useEffect(() => {
    if (sessionId && isConnected) {
      heartbeatRef.current = window.setInterval(async () => {
        try {
          await apiRequest("POST", `/api/sessions/${sessionId}/heartbeat`);
        } catch (error) {
          console.error("Heartbeat failed:", error);
        }
      }, 30000);
    }
    
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [sessionId, isConnected]);

  const handleJoin = useCallback(async (configOverride?: VoiceConfig) => {
    const joinConfig = configOverride || config;
    
    if (!joinConfig.appId || !joinConfig.channelId || !joinConfig.userId) {
      toast({
        title: "Missing Configuration",
        description: "Please provide App ID, Channel ID, and User ID",
        variant: "destructive",
      });
      return;
    }

    try {
      const sessionRes = await apiRequest("POST", "/api/sessions", {
        channelId: joinConfig.channelId,
        userId: joinConfig.userId,
      });

      const sessionData = await sessionRes.json();
      setSessionId(sessionData.sessionId);
      addLog(`Session created: ${sessionData.sessionId}`, "info");

      const uid = await join(
        joinConfig.appId,
        joinConfig.channelId,
        joinConfig.token || null,
        joinConfig.userId
      );
      setLocalUserId(uid);
      toast({
        title: "Connected",
        description: `Joined ${clubName || joinConfig.channelId} as ${uid}`,
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to join channel",
        variant: "destructive",
      });
    }
  }, [config, clubName, join, toast, addLog]);

  useEffect(() => {
    if (!pendingJoinRef.current) return;
    if (!sdkLoaded) return;
    if (isConnected || isConnecting) return;
    
    const pendingConfig = pendingJoinRef.current;
    pendingJoinRef.current = null;
    
    handleJoin(pendingConfig);
  }, [sdkLoaded, isConnected, isConnecting, handleJoin]);

  const handleLeave = useCallback(async () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    const currentSessionId = sessionId;
    if (currentSessionId) {
      setSessionId(null);
      try {
        await apiRequest("DELETE", `/api/sessions/${currentSessionId}`);
        addLog("Session ended", "info");
      } catch (error) {
        console.error("Failed to end session:", error);
      }
    }

    await leave();
    setLocalUserId(undefined);
    setLocalAudioLevel(0);
    toast({
      title: "Disconnected",
      description: "Left the voice channel",
    });
  }, [leave, toast, sessionId, addLog]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (leaveRef.current) {
        leaveRef.current().catch(() => {});
      }
      if (sessionIdRef.current) {
        const token = localStorage.getItem("authToken");
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        fetch(`/api/sessions/${sessionIdRef.current}`, { method: "DELETE", headers }).catch(() => {});
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <div className="max-w-2xl mx-auto px-4 py-8 md:px-8 relative">
        <div className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="icon"
            onClick={async () => {
              try {
                await apiRequest("POST", "/api/server/restart");
                toast({
                  title: "Server Restarting",
                  description: "The server will restart shortly. Please wait...",
                });
              } catch (error) {
                toast({
                  title: "Restart Failed",
                  description: "Failed to restart server",
                  variant: "destructive",
                });
              }
            }}
            title="Restart Server"
            data-testid="button-restart-server"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onLogout}
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-primary/10">
              <Headphones className="w-8 h-8 text-primary" />
            </div>
            <h1 
              className="text-3xl md:text-4xl font-bold tracking-tight"
              data-testid="text-page-title"
            >
              Voice Listener
            </h1>
          </div>
          <p className="text-muted-foreground text-sm md:text-base">
            Join voice chat channels from your browser
          </p>
        </header>

        <div className="space-y-6">
          {!sdkLoaded && !sdkError && (
            <AlertBanner
              type="loading"
              message="Loading voice engine..."
            />
          )}

          {sdkError && (
            <AlertBanner
              type="error"
              title="SDK Load Failed"
              message={sdkError}
            />
          )}

          <StatusDisplay 
            status={status} 
            networkQuality={networkQuality}
          />

          <CodeInput
            onCredentialsFetched={handleCredentialsFetched}
            disabled={isConnected || isConnecting}
            isAdmin={isAdmin}
          />

          {clubName && !isConnected && (
            <div className="text-center text-sm text-muted-foreground">
              Ready to join: <span className="font-medium text-foreground">{clubName}</span>
            </div>
          )}

          {!isConnected && (
            <Button
              onClick={() => handleJoin()}
              disabled={!canJoin}
              className="w-full h-12 text-base font-semibold"
              data-testid="button-join"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Connecting...
                </>
              ) : !sdkLoaded ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Loading SDK...
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  Join Channel
                </>
              )}
            </Button>
          )}

          {isConnected && (
            <>
              <UserList
                remoteUsers={remoteUsers}
                localUserId={localUserId}
                localIsMuted={isMuted}
                localAudioLevel={localAudioLevel}
              />

              <AudioControls onLeave={handleLeave} />
            </>
          )}

          <LogsConsole 
            logs={logs} 
            onClear={clearLogs}
          />
        </div>

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          <p>Voice Listener</p>
        </footer>
      </div>
    </div>
  );
}

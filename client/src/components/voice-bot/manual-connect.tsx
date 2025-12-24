import { useState, useEffect } from "react";
import { Hash, Key, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

interface ManualConnectProps {
  onConnect: (config: {
    appId: string;
    channelId: string;
    userId: string;
    token: string;
  }) => void;
  isConnecting: boolean;
  isConnected: boolean;
  disabled: boolean;
}

interface AgoraConfig {
  appId: string;
  userId: string;
}

export function ManualConnect({ onConnect, isConnecting, isConnected, disabled }: ManualConnectProps) {
  const [channelId, setChannelId] = useState("");
  const [token, setToken] = useState("");

  const { data: agoraConfig, isLoading: isLoadingConfig } = useQuery<AgoraConfig>({
    queryKey: ["/api/config/agora"],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agoraConfig?.appId || !channelId || !agoraConfig?.userId) return;
    
    onConnect({
      appId: agoraConfig.appId,
      channelId,
      userId: agoraConfig.userId,
      token,
    });
  };

  const canConnect = agoraConfig?.appId && channelId && agoraConfig?.userId && !isConnecting && !isConnected && !disabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="w-5 h-5" />
          Manual Connection
        </CardTitle>
        <CardDescription>
          Enter channel ID and token to connect directly
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingConfig ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="channelId">Channel ID</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="channelId"
                  placeholder="Enter Channel ID"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  disabled={isConnecting || isConnected}
                  className="pl-10"
                  data-testid="input-manual-channel"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="token">Token (Optional)</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="token"
                  placeholder="Enter Token (if required)"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={isConnecting || isConnected}
                  className="pl-10"
                  data-testid="input-manual-token"
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>App ID and User ID are configured on the server.</p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!canConnect}
              data-testid="button-manual-connect"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

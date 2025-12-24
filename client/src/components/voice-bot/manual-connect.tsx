import { useState } from "react";
import { Hash, Key, User, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

export function ManualConnect({ onConnect, isConnecting, isConnected, disabled }: ManualConnectProps) {
  const [appId, setAppId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [userId, setUserId] = useState("");
  const [token, setToken] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId || !channelId || !userId) return;
    
    onConnect({
      appId,
      channelId,
      userId,
      token,
    });
  };

  const canConnect = appId && channelId && userId && !isConnecting && !isConnected && !disabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="w-5 h-5" />
          Manual Connection
        </CardTitle>
        <CardDescription>
          Enter your Agora credentials to connect directly
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="appId">App ID</Label>
            <div className="relative">
              <Radio className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="appId"
                placeholder="Enter Agora App ID"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                disabled={isConnecting || isConnected}
                className="pl-10"
                data-testid="input-manual-appid"
              />
            </div>
          </div>

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
            <Label htmlFor="userId">User ID</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="userId"
                placeholder="Enter User ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={isConnecting || isConnected}
                className="pl-10"
                data-testid="input-manual-userid"
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
      </CardContent>
    </Card>
  );
}

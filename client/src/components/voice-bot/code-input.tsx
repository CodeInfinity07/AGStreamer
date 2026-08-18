import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Key, CheckCircle, Trash2, ShieldOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, handleUnauthorized } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

// Doesn't throw on non-2xx (unlike apiRequest) so the caller can read the
// server's error body instead of a generic connection-error message.
async function postCredentialsRequest(code: string, bypassFirewall: boolean): Promise<Response> {
  const token = localStorage.getItem("authToken");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch("/api/vc/fetch-credentials", {
    method: "POST",
    headers,
    body: JSON.stringify({ code, bypassFirewall }),
    credentials: "include",
  });
}

interface Credentials {
  appId: string;
  channel: string;
  token: string;
  userId: string;
  clubName: string;
}

interface RecentClub {
  code: string;
  clubName: string;
  usedAt: number;
}

interface CodeInputProps {
  onCredentialsFetched: (credentials: Credentials) => void;
  disabled?: boolean;
  isAdmin?: boolean;
}

export function CodeInput({ onCredentialsFetched, disabled, isAdmin }: CodeInputProps) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedClub, setFetchedClub] = useState<string | null>(null);
  const [bypassFirewall, setBypassFirewall] = useState(false);

  const { data: recentClubsData } = useQuery<{ clubs: RecentClub[] }>({
    queryKey: ["/api/clubs/recent"],
  });

  const recentClubs = recentClubsData?.clubs || [];

  const handleFetchCredentials = async (codeOverride?: string) => {
    const targetCode = (codeOverride ?? code).trim();

    if (!targetCode) {
      toast({
        title: "Code Required",
        description: "Please enter a code to fetch credentials",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await postCredentialsRequest(targetCode, isAdmin === true && bypassFirewall);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.credentials) {
          setCode(targetCode);
          setFetchedClub(data.credentials.clubName || "Channel");
          onCredentialsFetched(data.credentials);
          queryClient.invalidateQueries({ queryKey: ["/api/clubs/recent"] });
          toast({
            title: "Credentials Fetched",
            description: `Ready to join ${data.credentials.clubName || "channel"}`,
          });
        }
      } else if (response.status === 401) {
        handleUnauthorized();
        setFetchedClub(null);
      } else {
        const errorData = await response.json();
        toast({
          title: "Failed to Fetch",
          description: errorData.error || "Invalid code or server error",
          variant: "destructive",
        });
        setFetchedClub(null);
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Unable to connect to credentials server",
        variant: "destructive",
      });
      setFetchedClub(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRecentClub = async (clubCode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest("DELETE", `/api/clubs/recent/${encodeURIComponent(clubCode)}`);
      queryClient.invalidateQueries({ queryKey: ["/api/clubs/recent"] });
      toast({
        title: "Club Removed",
        description: "Club removed from recent list",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove club",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !disabled && !isLoading) {
      handleFetchCredentials();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Key className="w-5 h-5" />
          Channel Code
        </CardTitle>
        <CardDescription>
          Enter a code to fetch credentials or pick a recent club
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Fetch New Credentials</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter channel code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={disabled || isLoading}
              className="flex-1"
              data-testid="input-channel-code"
            />
            <Button
              onClick={() => handleFetchCredentials()}
              disabled={disabled || isLoading || !code.trim()}
              data-testid="button-fetch-credentials"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                "Fetch"
              )}
            </Button>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center justify-between gap-2 px-1">
            <Label htmlFor="bypass-firewall" className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
              <ShieldOff className="w-3.5 h-3.5" />
              Bypass voice firewall check
            </Label>
            <Switch
              id="bypass-firewall"
              checked={bypassFirewall}
              onCheckedChange={setBypassFirewall}
              disabled={disabled || isLoading}
              data-testid="switch-bypass-firewall"
            />
          </div>
        )}

        {recentClubs.length > 0 && (
          <div className="space-y-2">
            <Label>Recent Clubs</Label>
            <div className="h-56 overflow-y-auto rounded-md border divide-y" data-testid="list-recent-clubs">
              {recentClubs.map((club) => (
                <div
                  key={club.code}
                  className="flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => handleFetchCredentials(club.code)}
                    disabled={disabled || isLoading}
                    className="flex-1 min-w-0 text-left px-3 py-2 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid={`button-recent-club-${club.code}`}
                  >
                    <div className="text-sm font-medium truncate">{club.clubName || club.code}</div>
                    <div className="text-xs text-muted-foreground truncate">{club.code}</div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 mr-2"
                    onClick={(e) => handleDeleteRecentClub(club.code, e)}
                    disabled={disabled || isLoading}
                    data-testid={`button-delete-club-${club.code}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {fetchedClub && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Ready to join: {fetchedClub}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

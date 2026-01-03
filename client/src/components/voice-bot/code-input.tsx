import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Key, CheckCircle, Clock, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

interface Credentials {
  appId: string;
  channel: string;
  token: string;
  userId: string;
  clubName: string;
}

interface SavedClub {
  code: string;
  clubName: string;
  appId: string;
  channel: string;
  token: string;
  userId: string;
  savedAt: number;
  expiresAt: number;
}

interface CodeInputProps {
  onCredentialsFetched: (credentials: Credentials) => void;
  disabled?: boolean;
}

function formatTimeRemaining(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return "Expired";
  
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function CodeInput({ onCredentialsFetched, disabled }: CodeInputProps) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedClub, setFetchedClub] = useState<string | null>(null);

  const { data: savedClubsData, isLoading: isLoadingSaved } = useQuery<{ clubs: SavedClub[] }>({
    queryKey: ["/api/clubs/saved"],
  });

  const savedClubs = savedClubsData?.clubs || [];

  const handleFetchCredentials = async () => {
    if (!code.trim()) {
      toast({
        title: "Code Required",
        description: "Please enter a code to fetch credentials",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/vc/fetch-credentials", { code: code.trim() });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.credentials) {
          setFetchedClub(data.credentials.clubName || "Channel");
          onCredentialsFetched(data.credentials);
          queryClient.invalidateQueries({ queryKey: ["/api/clubs/saved"] });
          toast({
            title: "Credentials Fetched",
            description: `Ready to join ${data.credentials.clubName || "channel"}`,
          });
        }
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

  const handleSelectSavedClub = (channel: string) => {
    const club = savedClubs.find((c) => c.channel === channel);
    if (club) {
      setFetchedClub(club.clubName);
      onCredentialsFetched({
        appId: club.appId,
        channel: club.channel,
        token: club.token,
        userId: club.userId,
        clubName: club.clubName,
      });
      toast({
        title: "Club Selected",
        description: `Ready to join ${club.clubName}`,
      });
    }
  };

  const handleDeleteSavedClub = async (channel: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest("DELETE", `/api/clubs/saved/${encodeURIComponent(channel)}`);
      queryClient.invalidateQueries({ queryKey: ["/api/clubs/saved"] });
      toast({
        title: "Club Removed",
        description: "Saved club has been removed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove saved club",
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
          Enter a code to fetch credentials or select a saved club
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {savedClubs.length > 0 && (
          <div className="space-y-2">
            <Label>Saved Clubs</Label>
            <Select onValueChange={handleSelectSavedClub} disabled={disabled}>
              <SelectTrigger data-testid="select-saved-club">
                <SelectValue placeholder="Select a saved club..." />
              </SelectTrigger>
              <SelectContent>
                {savedClubs.map((club) => (
                  <SelectItem key={club.channel} value={club.channel}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{club.clubName}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeRemaining(club.expiresAt)}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savedClubs.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {savedClubs.map((club) => (
                  <div
                    key={club.channel}
                    className="flex items-center gap-2 text-xs bg-muted px-2 py-1 rounded-md"
                  >
                    <span>{club.clubName}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0"
                      onClick={(e) => handleDeleteSavedClub(club.channel, e)}
                      data-testid={`button-delete-club-${club.channel}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
              onClick={handleFetchCredentials}
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

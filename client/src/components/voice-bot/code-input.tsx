import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Key, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Credentials {
  appId: string;
  channel: string;
  token: string;
  userId: string;
  clubName: string;
}

interface CodeInputProps {
  onCredentialsFetched: (credentials: Credentials) => void;
  disabled?: boolean;
}

export function CodeInput({ onCredentialsFetched, disabled }: CodeInputProps) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedClub, setFetchedClub] = useState<string | null>(null);

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
          Enter the channel code to fetch your voice chat credentials
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter channel code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled || isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleFetchCredentials}
            disabled={disabled || isLoading || !code.trim()}
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

import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert, ShieldCheck, ShieldPlus, Trash2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  checkFirewall,
  listFirewall,
  addFirewall,
  removeFirewall,
  type FirewallEntry,
  type FirewallCheckResult,
} from "@/lib/firewallApi";

export default function FirewallPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [checkCode, setCheckCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<FirewallCheckResult | null>(null);

  const [addCode, setAddCode] = useState("");
  const [addReason, setAddReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingCode, setRemovingCode] = useState<string | null>(null);

  const { data: clubs = [], isLoading } = useQuery<FirewallEntry[]>({
    queryKey: ["/api/firewall"],
    queryFn: listFirewall,
  });

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = checkCode.trim();
    if (!code) return;

    setIsChecking(true);
    setCheckResult(null);
    try {
      const result = await checkFirewall(code);
      setCheckResult(result);
    } catch (error) {
      toast({
        title: "Check Failed",
        description: error instanceof Error ? error.message : "Could not reach the voice firewall service",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = addCode.trim();
    if (!code) return;

    setIsSubmitting(true);
    try {
      const result = await addFirewall(code, addReason.trim() || undefined);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/firewall"] });
        setAddCode("");
        setAddReason("");
        toast({
          title: "Club Added",
          description: `${code} is now firewall-protected`,
        });
      } else {
        toast({
          title: "Failed to Add",
          description: result.error || "Something went wrong",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to Add",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (code: string) => {
    setRemovingCode(code);
    try {
      const result = await removeFirewall(code);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/firewall"] });
        toast({
          title: "Club Removed",
          description: `${code} removed from the voice firewall`,
        });
      } else {
        toast({
          title: "Failed to Remove",
          description: result.error || "Something went wrong",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to Remove",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setRemovingCode(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <div className="max-w-2xl mx-auto px-4 py-8 md:px-8 space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back-to-voice-bot"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Voice Firewall
            </h1>
            <p className="text-sm text-muted-foreground">
              Check, add, and remove firewall-protected club codes
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Check a Club</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleCheck} className="flex gap-2">
              <Input
                type="text"
                placeholder="Club code"
                value={checkCode}
                onChange={(e) => setCheckCode(e.target.value)}
                disabled={isChecking}
                className="flex-1"
                data-testid="input-check-code"
              />
              <Button type="submit" disabled={isChecking || !checkCode.trim()} data-testid="button-check-firewall">
                {isChecking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Check
                  </>
                )}
              </Button>
            </form>
            {checkResult && (
              <div className="flex items-center gap-2 text-sm" data-testid="text-check-result">
                {checkResult.blocked ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-destructive" />
                    <span>
                      <span className="font-medium">{checkResult.club_code}</span> is protected
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span>
                      <span className="font-medium">{checkResult.club_code}</span> is free
                    </span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add to Firewall</CardTitle>
            <CardDescription>Protected clubs won't be scraped for credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label htmlFor="add-firewall-code" className="text-xs">Club Code</Label>
                <Input
                  id="add-firewall-code"
                  type="text"
                  placeholder="1508420"
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value)}
                  disabled={isSubmitting}
                  data-testid="input-add-firewall-code"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-firewall-reason" className="text-xs">Reason (optional)</Label>
                <Input
                  id="add-firewall-reason"
                  type="text"
                  placeholder="Optional"
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  disabled={isSubmitting}
                  data-testid="input-add-firewall-reason"
                />
              </div>
              <Button type="submit" disabled={isSubmitting || !addCode.trim()} data-testid="button-add-firewall">
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ShieldPlus className="w-4 h-4 mr-2" />
                    Add
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Firewalled Clubs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[28rem] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Club Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                        Loading firewalled clubs...
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && clubs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                        No clubs are firewalled
                      </TableCell>
                    </TableRow>
                  )}
                  {clubs.map((club) => (
                    <TableRow key={club.club_code} data-testid={`row-firewall-${club.club_code}`}>
                      <TableCell className="font-medium">{club.club_code}</TableCell>
                      <TableCell className="max-w-[160px] truncate text-muted-foreground">
                        {club.club_name ? String(club.club_name) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-muted-foreground">
                        {club.reason ? String(club.reason) : (
                          <Badge variant="secondary" className="text-xs">no reason</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={removingCode === club.club_code}
                          onClick={() => handleRemove(club.club_code)}
                          data-testid={`button-remove-firewall-${club.club_code}`}
                        >
                          {removingCode === club.club_code ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

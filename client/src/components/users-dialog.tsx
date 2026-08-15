import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Trash2, Shield, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { fetchUsers, createUser, removeUser, type AppUser, type UserRole } from "@/lib/usersApi";

interface UsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserEmail?: string;
}

export function UsersDialog({ open, onOpenChange, currentUserEmail }: UsersDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
    queryFn: fetchUsers,
    enabled: open,
  });

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setRole("user");
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({
        title: "Missing Fields",
        description: "Please provide an email and password",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createUser({ email: email.trim(), password, role });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      resetForm();
      toast({
        title: "User Added",
        description: `${email.trim()} can now sign in`,
      });
    } catch (error) {
      toast({
        title: "Failed to Add User",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveUser = async (user: AppUser) => {
    setDeletingId(user.id);
    try {
      await removeUser(user.id);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Removed",
        description: `${user.email} no longer has access`,
      });
    } catch (error) {
      toast({
        title: "Failed to Remove User",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Users
          </DialogTitle>
          <DialogDescription>
            Manage who can sign in and who has admin access
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
          <div className="space-y-1">
            <Label htmlFor="new-user-email" className="text-xs">Email</Label>
            <Input
              id="new-user-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              data-testid="input-new-user-email"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-user-password" className="text-xs">Password</Label>
            <Input
              id="new-user-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              data-testid="input-new-user-password"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={isSubmitting}>
              <SelectTrigger className="w-24" data-testid="select-new-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isSubmitting} data-testid="button-add-user">
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Add
              </>
            )}
          </Button>
        </form>

        <div className="max-h-72 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                    Loading users...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                    No users yet
                  </TableCell>
                </TableRow>
              )}
              {users.map((user) => (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell className="max-w-[180px] truncate">
                    {user.email}
                    {user.email === currentUserEmail && (
                      <span className="text-xs text-muted-foreground ml-1">(you)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={deletingId === user.id || user.email === currentUserEmail}
                      onClick={() => handleRemoveUser(user)}
                      data-testid={`button-remove-user-${user.id}`}
                    >
                      {deletingId === user.id ? (
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
      </DialogContent>
    </Dialog>
  );
}

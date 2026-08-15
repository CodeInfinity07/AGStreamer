import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, type ConnectionMode } from "@/components/app-sidebar";
import { UsersDialog } from "@/components/users-dialog";
import NotFound from "@/pages/not-found";
import VoiceBot from "@/pages/voice-bot";
import Login from "@/pages/login";

function Router({
  isAuthenticated,
  onLogout,
}: {
  isAuthenticated: boolean;
  onLogout: () => void;
}) {
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Switch>
      <Route path="/" component={() => <VoiceBot onLogout={onLogout} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("code");
  const [isConnected, setIsConnected] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      fetch("/api/auth/verify", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setAuthToken(token);
            setRole(data.role || null);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem("authToken");
            localStorage.removeItem("userEmail");
          }
        })
        .catch(() => {
          localStorage.removeItem("authToken");
          localStorage.removeItem("userEmail");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleLoginSuccess = (loginRole: string) => {
    const token = localStorage.getItem("authToken");
    setAuthToken(token);
    setRole(loginRole || null);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    const token = localStorage.getItem("authToken");
    if (token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem("authToken");
    localStorage.removeItem("userEmail");
    setAuthToken(null);
    setRole(null);
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <ThemeProvider defaultTheme="system">
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </ThemeProvider>
    );
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ThemeProvider defaultTheme="system">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          {!isAuthenticated ? (
            <Login onLoginSuccess={handleLoginSuccess} />
          ) : (
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex min-h-screen w-full">
                <AppSidebar
                  mode={connectionMode}
                  onModeChange={setConnectionMode}
                  isConnected={isConnected}
                  isAdmin={role === "admin"}
                  onOpenUsers={() => setUsersDialogOpen(true)}
                />
                <main className="flex-1 overflow-auto">
                  <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b p-2">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                  </div>
                  <VoiceBot
                    onLogout={handleLogout}
                    onConnectionChange={setIsConnected}
                  />
                </main>
                {role === "admin" && (
                  <UsersDialog
                    open={usersDialogOpen}
                    onOpenChange={setUsersDialogOpen}
                    currentUserEmail={localStorage.getItem("userEmail") || undefined}
                  />
                )}
              </div>
            </SidebarProvider>
          )}
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

import { useLocation } from "wouter";
import { Radio, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

interface AppSidebarProps {
  isConnected: boolean;
  isAdmin?: boolean;
}

export function AppSidebar({ isConnected, isAdmin }: AppSidebarProps) {
  const [location, setLocation] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Radio className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Voice Bot</h2>
            <p className="text-xs text-muted-foreground">Connection Options</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Connection Method</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setLocation("/")}
                  isActive={location === "/"}
                  disabled={isConnected}
                  className="flex flex-col items-start gap-1 h-auto py-3"
                  data-testid="button-mode-code"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Radio className="w-4 h-4" />
                    <span>Join via Code</span>
                    {location === "/" && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground pl-6">
                    Enter a code to fetch credentials
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setLocation("/users")}
                    isActive={location === "/users"}
                    disabled={isConnected}
                    data-testid="button-open-users"
                  >
                    <Users className="w-4 h-4" />
                    <span>Users</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          {isConnected ? "Disconnect to navigate" : "Select a page"}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

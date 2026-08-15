import { useState } from "react";
import { Radio, Settings, Users } from "lucide-react";
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

export type ConnectionMode = "code";

interface AppSidebarProps {
  mode: ConnectionMode;
  onModeChange: (mode: ConnectionMode) => void;
  isConnected: boolean;
  isAdmin?: boolean;
  onOpenUsers?: () => void;
}

const menuItems = [
  {
    title: "Join via Code",
    mode: "code" as ConnectionMode,
    icon: Radio,
    description: "Enter a code to fetch credentials",
  },
];

export function AppSidebar({ mode, onModeChange, isConnected, isAdmin, onOpenUsers }: AppSidebarProps) {
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
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.mode}>
                  <SidebarMenuButton
                    onClick={() => onModeChange(item.mode)}
                    isActive={mode === item.mode}
                    disabled={isConnected}
                    className="flex flex-col items-start gap-1 h-auto py-3"
                    data-testid={`button-mode-${item.mode}`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                      {mode === item.mode && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground pl-6">
                      {item.description}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
                    onClick={onOpenUsers}
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
          {isConnected ? "Disconnect to change mode" : "Select a connection method"}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

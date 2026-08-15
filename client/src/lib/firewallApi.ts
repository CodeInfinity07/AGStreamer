import { apiRequest } from "@/lib/queryClient";

export interface FirewallCheckResult {
  club_code: string;
  blocked: boolean;
}

export interface FirewallEntry {
  club_code: string;
  reason?: string;
  [key: string]: unknown;
}

export interface FirewallMutationResult {
  success: boolean;
  club_code?: string;
  error?: string;
}

export async function checkFirewall(code: string): Promise<FirewallCheckResult> {
  const res = await apiRequest("GET", `/api/firewall/check/${encodeURIComponent(code)}`);
  return res.json();
}

export async function listFirewall(): Promise<FirewallEntry[]> {
  const res = await apiRequest("GET", "/api/firewall");
  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data.firewall || data.clubs || data.results || [];
}

export async function addFirewall(code: string, reason?: string): Promise<FirewallMutationResult> {
  const res = await apiRequest("POST", "/api/firewall", { club_code: code, reason });
  return res.json();
}

export async function removeFirewall(code: string): Promise<FirewallMutationResult> {
  const res = await apiRequest("DELETE", `/api/firewall/${encodeURIComponent(code)}`);
  return res.json();
}

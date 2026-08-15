import { apiRequest } from "@/lib/queryClient";

export type UserRole = "admin" | "user";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: number;
}

export async function fetchUsers(): Promise<AppUser[]> {
  const res = await apiRequest("GET", "/api/users");
  const data = await res.json();
  return data.users || [];
}

export async function createUser(entry: { email: string; password: string; role: UserRole }): Promise<AppUser> {
  const res = await apiRequest("POST", "/api/users", entry);
  return res.json();
}

export async function removeUser(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/users/${encodeURIComponent(id)}`);
}

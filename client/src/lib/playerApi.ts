import { apiRequest } from "@/lib/queryClient";

export interface PlayerInfo {
  gc: string;
  name: string | null;
  snuid: string | null;
  uid: string | null;
  found: boolean;
}

export async function lookupPlayers(ids: Array<string | number>): Promise<PlayerInfo[]> {
  const gcs = Array.from(
    new Set(ids.map((id) => String(id).trim()).filter((id) => id.length > 0))
  );

  if (gcs.length === 0) return [];

  const res = await apiRequest("POST", "/api/players/batch", { gcs });
  const data = await res.json();
  return Array.isArray(data) ? data : (data.results ?? []);
}

export function getAvatarUrl(snuid: string | null | undefined): string {
  if (!snuid) return "";
  return `https://graph.facebook.com/${snuid}/picture?type=normal`;
}

const VOICE_FIREWALL_URL = process.env.VOICE_FIREWALL_URL || "https://players.xorbots.live";
const VOICE_FIREWALL_KEY = process.env.VOICE_FIREWALL_KEY || "vfw_K7x2Rp9Qm4Ln8Wz3Fy6Bv1Hs5Cd0Tg";

const REQUEST_TIMEOUT_MS = 10000;

async function firewallFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${VOICE_FIREWALL_URL}${path}`, {
      ...init,
      headers: {
        "X-Voice-Key": VOICE_FIREWALL_KEY,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface FirewallCheckResult {
  club_code: string;
  blocked: boolean;
}

export interface FirewallMutationResult {
  success: boolean;
  club_code?: string;
  error?: string;
}

// Returns null on any infrastructure failure (network error, timeout, bad
// upstream response) so callers can decide how to fail (open vs. closed).
export async function checkClub(code: string): Promise<FirewallCheckResult | null> {
  try {
    const res = await firewallFetch(`/api/voice-firewall/check/${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Voice firewall check failed:", error);
    return null;
  }
}

export async function addClub(code: string, reason?: string): Promise<FirewallMutationResult> {
  try {
    const res = await firewallFetch("/api/voice-firewall", {
      method: "POST",
      body: JSON.stringify({ club_code: code, ...(reason ? { reason } : {}) }),
    });
    return await res.json();
  } catch (error) {
    console.error("Voice firewall add failed:", error);
    return { success: false, error: "Failed to reach voice firewall service" };
  }
}

export async function removeClub(code: string): Promise<FirewallMutationResult> {
  try {
    const res = await firewallFetch(`/api/voice-firewall/${encodeURIComponent(code)}`, {
      method: "DELETE",
    });
    return await res.json();
  } catch (error) {
    console.error("Voice firewall remove failed:", error);
    return { success: false, error: "Failed to reach voice firewall service" };
  }
}

// Throws on failure — the route handler maps that to a 502.
export async function listClubs(): Promise<unknown> {
  const res = await firewallFetch("/api/voice-firewall");
  if (!res.ok) {
    throw new Error(`Voice firewall list failed with status ${res.status}`);
  }
  return res.json();
}

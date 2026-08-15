import * as fs from "fs";
import * as path from "path";

const CLUBS_FILE = path.join(process.cwd(), "data", "recent-clubs.json");
const MAX_RECENT_CLUBS = 15;

export interface RecentClub {
  code: string;
  clubName: string;
  usedAt: number;
}

interface RecentClubsData {
  users: Record<string, RecentClub[]>;
}

function ensureDataDir() {
  const dataDir = path.dirname(CLUBS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadData(): RecentClubsData {
  ensureDataDir();
  try {
    if (fs.existsSync(CLUBS_FILE)) {
      const data = fs.readFileSync(CLUBS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      // Migrate the old single-list-for-everyone shape ({ clubs: [...] })
      // into an empty per-user store; the old shared history isn't
      // attributable to any one user, so it's dropped rather than guessed.
      if (Array.isArray(parsed.clubs) && !parsed.users) {
        return { users: {} };
      }
      return { users: parsed.users || {} };
    }
  } catch (error) {
    console.error("Error loading recent clubs:", error);
  }
  return { users: {} };
}

function writeData(data: RecentClubsData) {
  ensureDataDir();
  fs.writeFileSync(CLUBS_FILE, JSON.stringify(data, null, 2));
}

export function getRecentClubs(userId: string): RecentClub[] {
  return loadData().users[userId] || [];
}

export function addRecentClub(userId: string, entry: { code: string; clubName: string }): RecentClub {
  const data = loadData();
  const existing = data.users[userId] || [];
  const filtered = existing.filter((c) => c.code !== entry.code);

  const newClub: RecentClub = {
    code: entry.code,
    clubName: entry.clubName,
    usedAt: Date.now(),
  };

  data.users[userId] = [newClub, ...filtered].slice(0, MAX_RECENT_CLUBS);
  writeData(data);
  return newClub;
}

export function deleteRecentClub(userId: string, code: string): boolean {
  const data = loadData();
  const existing = data.users[userId] || [];
  const filtered = existing.filter((c) => c.code !== code);

  if (filtered.length !== existing.length) {
    data.users[userId] = filtered;
    writeData(data);
    return true;
  }
  return false;
}

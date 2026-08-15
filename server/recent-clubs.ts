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
  clubs: RecentClub[];
}

function ensureDataDir() {
  const dataDir = path.dirname(CLUBS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadClubs(): RecentClubsData {
  ensureDataDir();
  try {
    if (fs.existsSync(CLUBS_FILE)) {
      const data = fs.readFileSync(CLUBS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading recent clubs:", error);
  }
  return { clubs: [] };
}

function writeClubs(data: RecentClubsData) {
  ensureDataDir();
  fs.writeFileSync(CLUBS_FILE, JSON.stringify(data, null, 2));
}

export function getRecentClubs(): RecentClub[] {
  return loadClubs().clubs;
}

export function addRecentClub(entry: { code: string; clubName: string }): RecentClub {
  const data = loadClubs();
  const filtered = data.clubs.filter((c) => c.code !== entry.code);

  const newClub: RecentClub = {
    code: entry.code,
    clubName: entry.clubName,
    usedAt: Date.now(),
  };

  const clubs = [newClub, ...filtered].slice(0, MAX_RECENT_CLUBS);
  writeClubs({ clubs });
  return newClub;
}

export function deleteRecentClub(code: string): boolean {
  const data = loadClubs();
  const filtered = data.clubs.filter((c) => c.code !== code);

  if (filtered.length !== data.clubs.length) {
    writeClubs({ clubs: filtered });
    return true;
  }
  return false;
}

import * as fs from "fs";
import * as path from "path";

const CLUBS_FILE = path.join(process.cwd(), "data", "saved-clubs.json");
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SavedClub {
  code: string;
  clubName: string;
  appId: string;
  channel: string;
  token: string;
  userId: string;
  savedAt: number;
  expiresAt: number;
}

interface SavedClubsData {
  clubs: SavedClub[];
}

function ensureDataDir() {
  const dataDir = path.dirname(CLUBS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadClubs(): SavedClubsData {
  ensureDataDir();
  try {
    if (fs.existsSync(CLUBS_FILE)) {
      const data = fs.readFileSync(CLUBS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading saved clubs:", error);
  }
  return { clubs: [] };
}

function saveClubs(data: SavedClubsData) {
  ensureDataDir();
  fs.writeFileSync(CLUBS_FILE, JSON.stringify(data, null, 2));
}

function cleanExpired(clubs: SavedClub[]): SavedClub[] {
  const now = Date.now();
  return clubs.filter((club) => club.expiresAt > now);
}

export function getSavedClubs(): SavedClub[] {
  const data = loadClubs();
  const validClubs = cleanExpired(data.clubs);
  
  if (validClubs.length !== data.clubs.length) {
    saveClubs({ clubs: validClubs });
  }
  
  return validClubs;
}

export function saveClub(credentials: {
  code: string;
  clubName: string;
  appId: string;
  channel: string;
  token: string;
  userId: string;
}): SavedClub {
  const data = loadClubs();
  const validClubs = cleanExpired(data.clubs);
  
  const now = Date.now();
  const newClub: SavedClub = {
    ...credentials,
    savedAt: now,
    expiresAt: now + EXPIRY_MS,
  };
  
  const existingIndex = validClubs.findIndex(
    (c) => c.code === credentials.code || c.channel === credentials.channel
  );
  
  if (existingIndex >= 0) {
    validClubs[existingIndex] = newClub;
  } else {
    validClubs.push(newClub);
  }
  
  saveClubs({ clubs: validClubs });
  return newClub;
}

export function getClubByChannel(channel: string): SavedClub | undefined {
  const clubs = getSavedClubs();
  return clubs.find((c) => c.channel === channel);
}

export function deleteClub(channel: string): boolean {
  const data = loadClubs();
  const validClubs = cleanExpired(data.clubs);
  const filtered = validClubs.filter((c) => c.channel !== channel);
  
  if (filtered.length !== validClubs.length) {
    saveClubs({ clubs: filtered });
    return true;
  }
  return false;
}

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

export type UserRole = "admin" | "user";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: number;
}

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: number;
}

interface UsersData {
  users: User[];
}

function ensureDataDir() {
  const dataDir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readUsersFile(): UsersData {
  ensureDataDir();
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading users:", error);
  }
  return { users: [] };
}

function writeUsersFile(data: UsersData) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

// Seeds the very first admin account from LOGIN_EMAIL/LOGIN_PASSWORD so
// existing deployments keep working without any manual migration step.
function bootstrapFromEnv(): UsersData {
  const email = process.env.LOGIN_EMAIL;
  const password = process.env.LOGIN_PASSWORD;
  if (!email || !password) {
    return { users: [] };
  }

  const admin: User = {
    id: crypto.randomUUID(),
    email,
    passwordHash: hashPassword(password),
    role: "admin",
    createdAt: Date.now(),
  };

  const data: UsersData = { users: [admin] };
  writeUsersFile(data);
  return data;
}

function loadUsers(): UsersData {
  const data = readUsersFile();
  if (data.users.length > 0) return data;
  return bootstrapFromEnv();
}

export function getUsers(): PublicUser[] {
  return loadUsers().users.map(toPublicUser);
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
}

export function verifyLogin(email: string, password: string): User | null {
  const data = loadUsers();
  const user = data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return null;
  return verifyPassword(password, user.passwordHash) ? user : null;
}

export function addUser(entry: { email: string; password: string; role: UserRole }): PublicUser {
  const data = loadUsers();

  if (data.users.some((u) => u.email.toLowerCase() === entry.email.toLowerCase())) {
    throw new Error("A user with this email already exists");
  }

  const newUser: User = {
    id: crypto.randomUUID(),
    email: entry.email,
    passwordHash: hashPassword(entry.password),
    role: entry.role,
    createdAt: Date.now(),
  };

  data.users.push(newUser);
  writeUsersFile(data);
  return toPublicUser(newUser);
}

export function deleteUser(id: string): void {
  const data = loadUsers();
  const target = data.users.find((u) => u.id === id);

  if (!target) {
    throw new Error("User not found");
  }

  const remainingAdmins = data.users.filter((u) => u.role === "admin" && u.id !== id);
  if (target.role === "admin" && remainingAdmins.length === 0) {
    throw new Error("Cannot remove the last admin");
  }

  writeUsersFile({ users: data.users.filter((u) => u.id !== id) });
}

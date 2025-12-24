import { type DailyUsage, MAX_CONNECTIONS_PER_DAY } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getDailyUsage(userId: string): Promise<DailyUsage>;
  incrementDailyUsage(userId: string): Promise<DailyUsage>;
  resetDailyUsage(userId: string): Promise<void>;
}

function getTodayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

export class MemStorage implements IStorage {
  private dailyUsage: Map<string, DailyUsage>;

  constructor() {
    this.dailyUsage = new Map();
  }

  async getDailyUsage(userId: string): Promise<DailyUsage> {
    const todayKey = getTodayDateKey();
    const usage = this.dailyUsage.get(userId);
    
    if (!usage || usage.dateKey !== todayKey) {
      return { dateKey: todayKey, count: 0 };
    }
    
    return usage;
  }

  async incrementDailyUsage(userId: string): Promise<DailyUsage> {
    const todayKey = getTodayDateKey();
    const current = await this.getDailyUsage(userId);
    
    const updated: DailyUsage = {
      dateKey: todayKey,
      count: current.count + 1,
    };
    
    this.dailyUsage.set(userId, updated);
    return updated;
  }

  async resetDailyUsage(userId: string): Promise<void> {
    this.dailyUsage.delete(userId);
  }
}

export const storage = new MemStorage();
export { getTodayDateKey, getResetTime };

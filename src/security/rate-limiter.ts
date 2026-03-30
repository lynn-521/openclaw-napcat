/**
 * Rate limiter for NapCat channel.
 * Implements per-user+group three-tier rate limiting: minute / hour / day.
 * Uses an in-memory Map — suitable for single-instance deployments.
 */

import type { NapCatAccountConfig } from "../types.js";

interface RateCount {
  minute: number;
  minuteWindow: number; // unix ms of current window start
  hour: number;
  hourWindow: number;
  day: number;
  dayWindow: number;
}

/** Key = "${userId}_${groupId}" for groups, "${userId}_dm" for private */
function buildKey(userId: number, groupId?: number): string {
  return groupId ? `${userId}_${groupId}` : `${userId}_dm`;
}

export class RateLimiter {
  private readonly counts = new Map<string, RateCount>();
  private readonly maxPerMinute: number;
  private readonly maxPerHour: number;
  private readonly maxPerDay: number;

  constructor(cfg: NapCatAccountConfig) {
    const rl = cfg.rateLimit;
    this.maxPerMinute = rl?.maxPerMinute ?? 20;
    this.maxPerHour = rl?.maxPerHour ?? 500;
    this.maxPerDay = rl?.maxPerDay ?? 3000;
  }

  /** Returns an error message string if blocked, or null if allowed. */
  check(userId: number, groupId?: number): string | null {
    if (this.maxPerMinute === Infinity && this.maxPerHour === Infinity && this.maxPerDay === Infinity) {
      return null;
    }

    const now = Date.now();
    const key = buildKey(userId, groupId);
    let rc = this.counts.get(key);

    if (!rc) {
      rc = { minute: 0, minuteWindow: now, hour: 0, hourWindow: now, day: 0, dayWindow: now };
      this.counts.set(key, rc);
    }

    // Sliding window: reset counters when window expires
    const MINUTE = 60_000;
    const HOUR = 3_600_000;
    const DAY = 86_400_000;

    if (now - rc.minuteWindow >= MINUTE) {
      rc.minute = 0;
      rc.minuteWindow = now;
    }
    if (now - rc.hourWindow >= HOUR) {
      rc.hour = 0;
      rc.hourWindow = now;
    }
    if (now - rc.dayWindow >= DAY) {
      rc.day = 0;
      rc.dayWindow = now;
    }

    // Check limits in ascending order of severity
    if (this.maxPerMinute > 0 && rc.minute >= this.maxPerMinute) {
      const secsLeft = Math.ceil((rc.minuteWindow + MINUTE - now) / 1000);
      return `⚠️ 速率超限：你每分钟最多 ${this.maxPerMinute} 条消息，请 ${secsLeft}s 后再试。`;
    }
    if (this.maxPerHour > 0 && rc.hour >= this.maxPerHour) {
      const minsLeft = Math.ceil((rc.hourWindow + HOUR - now) / 60000);
      return `⚠️ 速率超限：你每小时最多 ${this.maxPerHour} 条消息，请 ${minsLeft}m 后再试。`;
    }
    if (this.maxPerDay > 0 && rc.day >= this.maxPerDay) {
      const hrsLeft = Math.ceil((rc.dayWindow + DAY - now) / 3600000);
      return `⚠️ 速率超限：你每天最多 ${this.maxPerDay} 条消息，请 ${hrsLeft}h 后再试。`;
    }

    // Increment counters
    rc.minute++;
    rc.hour++;
    rc.day++;

    return null;
  }

  /** Clean up expired entries to prevent memory growth. Call periodically. */
  prune(): void {
    const now = Date.now();
    const MINUTE = 60_000;
    const HOUR = 3_600_000;
    const DAY = 86_400_000;

    for (const [key, rc] of this.counts.entries()) {
      if (
        now - rc.dayWindow > DAY * 2 &&
        now - rc.hourWindow > HOUR * 2 &&
        now - rc.minuteWindow > MINUTE * 2
      ) {
        this.counts.delete(key);
      }
    }
  }
}

/**
 * src/security/rate-limiter.ts
 * Token Bucket 频率限制器
 * 按 userId + action 维度限制操作频率，防止刷屏和 API 滥用
 */

export interface RateLimiterConfig {
  /** 每分钟最大请求数（per user per action） */
  maxPerMinute: number;
  /** 每小时最大请求数（per user per action） */
  maxPerHour: number;
  /** 是否启用 */
  enabled: boolean;
}

export interface RateLimiterEntry {
  minuteCount: number;
  minuteWindowStart: number; // Date.now()
  hourCount: number;
  hourWindowStart: number; // Date.now()
}

/** 默认配置 */
export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  enabled: true,
  maxPerMinute: 20,
  maxPerHour: 300,
};

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/**
 * Token Bucket 频率限制器
 * 以 userId + action 为粒度进行限速
 */
export class RateLimiter {
  private store = new Map<string, RateLimiterEntry>();
  private config: RateLimiterConfig;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMITER_CONFIG, ...config };
  }

  /** 生成限速 key：userId:action */
  private key(userId: string, action: string): string {
    return `${userId}:${action}`;
  }

  /** 清理过期条目（每小时调用一次即可） */
  cleanup(): void {
    const now = Date.now();
    for (const [k, entry] of this.store) {
      if (
        now - entry.hourWindowStart > HOUR_MS * 2 &&
        now - entry.minuteWindowStart > MINUTE_MS * 2
      ) {
        this.store.delete(k);
      }
    }
  }

  /**
   * 检查是否允许执行操作
   * @returns { allowed: boolean; reason?: string; retryAfterMs?: number }
   */
  check(userId: string, action: string): { allowed: boolean; reason?: string; retryAfterMs?: number } {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    const now = Date.now();
    const k = this.key(userId, action);
    let entry = this.store.get(k);

    // 首次访问或窗口已过期，重置窗口
    if (!entry || now - entry.minuteWindowStart > MINUTE_MS) {
      entry = {
        minuteCount: 0,
        minuteWindowStart: now,
        hourCount: 0,
        hourWindowStart: now,
      };
      this.store.set(k, entry);
    }

    // 小时窗口过期，重置小时计数
    if (now - entry.hourWindowStart > HOUR_MS) {
      entry.hourCount = 0;
      entry.hourWindowStart = now;
    }

    // 分钟窗口过期，重置分钟计数
    if (now - entry.minuteWindowStart > MINUTE_MS) {
      entry.minuteCount = 0;
      entry.minuteWindowStart = now;
    }

    // 检查分钟限制
    if (entry.minuteCount >= this.config.maxPerMinute) {
      const retryAfterMs = MINUTE_MS - (now - entry.minuteWindowStart);
      return {
        allowed: false,
        reason: `操作过于频繁，请 ${Math.ceil(retryAfterMs / 1000)}s 后再试（每分钟限制 ${this.config.maxPerMinute} 次）`,
        retryAfterMs,
      };
    }

    // 检查小时限制
    if (entry.hourCount >= this.config.maxPerHour) {
      const retryAfterMs = HOUR_MS - (now - entry.hourWindowStart);
      return {
        allowed: false,
        reason: `操作过于频繁，请 ${Math.ceil(retryAfterMs / 1000 / 60)} 分钟后重试（每小时限制 ${this.config.maxPerHour} 次）`,
        retryAfterMs,
      };
    }

    // 放行并计数
    entry.minuteCount++;
    entry.hourCount++;
    this.store.set(k, entry);

    return { allowed: true };
  }

  /** 获取当前用户的剩余配额（用于提示） */
  remaining(userId: string, action: string): { minute: number; hour: number } {
    const k = this.key(userId, action);
    const entry = this.store.get(k);
    if (!entry) {
      return { minute: this.config.maxPerMinute, hour: this.config.maxPerHour };
    }
    return {
      minute: Math.max(0, this.config.maxPerMinute - entry.minuteCount),
      hour: Math.max(0, this.config.maxPerHour - entry.hourCount),
    };
  }

  /** 更新配置 */
  updateConfig(config: Partial<RateLimiterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取配置 */
  getConfig(): RateLimiterConfig {
    return { ...this.config };
  }
}

/** 全局限速器实例（按 userId:action 索引） */
export const globalRateLimiter = new RateLimiter();

/** 按操作类别的独立限速器（不同操作不同限速） */
export const RATE_LIMIT_PROFILES: Record<string, Partial<RateLimiterConfig>> = {
  // 高频操作（发消息、查询）限制宽松
  default: { maxPerMinute: 30, maxPerHour: 500 },
  // 中频操作（禁言、踢人）限制严格
  moderate: { maxPerMinute: 10, maxPerHour: 100 },
  // 低频操作（改群名、发公告）限制极严
  sensitive: { maxPerMinute: 3, maxPerHour: 30 },
};

/**
 * 根据操作类型获取对应的限速器
 * @param action 操作名称（如 "send_msg", "mute_member", "set_group_name"）
 */
export function getRateLimiterForAction(action: string): RateLimiter {
  const profileKey = Object.keys(RATE_LIMIT_PROFILES).find((key) =>
    key !== "default" && action.toLowerCase().includes(key),
  ) ?? "default";

  const profile = RATE_LIMIT_PROFILES[profileKey];
  const limiter = new RateLimiter({ ...profile, enabled: true });
  return limiter;
}

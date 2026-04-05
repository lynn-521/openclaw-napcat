/**
 * src/security/audit-log.ts
 * QQ 控制操作审计日志
 * 记录所有高危操作的执行者、目标、时间、结果
 */

export type AuditActionCategory =
  | "message"
  | "member_management"
  | "group_management"
  | "friend_management"
  | "group_notice"
  | "group_file"
  | "group_setting"
  | "essence"
  | "request_handling"
  | "system";

export interface AuditLogEntry {
  /** 审计 ID */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** ISO 时间字符串 */
  isoTime: string;
  /** 执行操作的 QQ 号 */
  senderId: string;
  /** 执行者昵称 */
  senderName?: string;
  /** 群号（群操作时） */
  groupId?: string;
  /** 操作类型 */
  action: string;
  /** 操作类别 */
  category: AuditActionCategory;
  /** 操作描述 */
  description: string;
  /** 目标 QQ 号或群号 */
  targetId?: string;
  /** 操作参数（JSON 字符串，敏感字段脱敏） */
  params?: string;
  /** 结果：success | denied | error */
  result: "success" | "denied" | "error";
  /** 错误信息（失败时） */
  errorMessage?: string;
  /** 是否为机器人管理员操作 */
  isBotAdmin: boolean;
  /** 危险等级 */
  dangerLevel: string;
  /** 会话 ID */
  sessionKey?: string;
}

/**
 * 操作类别映射
 */
export const ACTION_CATEGORY_MAP: Record<string, AuditActionCategory> = {
  qq_like_user: "member_management",
  qq_get_user_info: "message",
  qq_get_group_info: "message",
  qq_get_group_member_info: "message",
  qq_get_friend_list: "friend_management",
  qq_get_group_list: "group_management",
  qq_get_group_member_list: "member_management",
  qq_get_group_honor_info: "group_management",
  qq_get_group_msg_history: "message",
  qq_get_friend_msg_history: "message",
  qq_get_essence_msg_list: "essence",
  qq_poke: "member_management",
  qq_recall_message: "message",
  qq_set_msg_emoji_like: "message",
  qq_ocr_image: "message",
  qq_translate_en2zh: "message",
  qq_mark_msg_as_read: "message",
  qq_mute_group_member: "member_management",
  qq_kick_group_member: "member_management",
  qq_set_group_admin: "group_management",
  qq_set_group_name: "group_setting",
  qq_set_group_whole_ban: "group_management",
  qq_send_group_notice: "group_notice",
  qq_get_group_notice: "group_notice",
  qq_delete_group_notice: "group_notice",
  qq_set_group_card: "member_management",
  qq_set_group_special_title: "member_management",
  qq_set_group_leave: "group_management",
  qq_set_group_portrait: "group_setting",
  qq_set_group_sign: "group_management",
  qq_set_group_remark: "group_setting",
  qq_get_group_at_all_remain: "group_management",
  qq_send_message: "message",
  qq_upload_file: "group_file",
  qq_forward_message: "message",
  qq_send_group_forward_msg: "message",
  qq_send_private_forward_msg: "message",
  qq_download_file: "group_file",
  qq_set_essence_msg: "essence",
  qq_delete_essence_msg: "essence",
  qq_set_friend_remark: "friend_management",
  qq_delete_friend: "friend_management",
  qq_handle_friend_request: "request_handling",
  qq_handle_group_request: "request_handling",
  qq_get_group_root_files: "group_file",
  qq_get_group_file_url: "group_file",
  qq_create_group_file_folder: "group_file",
  qq_delete_group_file: "group_file",
  // 系统操作
  group_join: "system",
  group_leave: "system",
  pairing_request: "system",
  pairing_approved: "system",
};

/**
 * 审计日志存储（内存 + 可选持久化回调）
 */
export class AuditLogStore {
  private entries: AuditLogEntry[] = [];
  private maxEntries: number;
  /** 可选的持久化回调 */
  private persistCallback?: (entries: AuditLogEntry[]) => Promise<void>;
  private persistTimer?: ReturnType<typeof setTimeout>;
  private dirty = false;

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
  }

  /** 设置持久化回调（例如写入文件或数据库） */
  setPersistCallback(cb: (entries: AuditLogEntry[]) => Promise<void>): void {
    this.persistCallback = cb;
  }

  /** 记录一条审计日志 */
  log(entry: Omit<AuditLogEntry, "id" | "timestamp" | "isoTime">): string {
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const fullEntry: AuditLogEntry = {
      ...entry,
      id,
      timestamp: now,
      isoTime: new Date(now).toISOString(),
    };

    this.entries.push(fullEntry);
    this.dirty = true;

    // 超过上限时清理最旧的条目
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // 异步持久化（防抖动：1秒内最多持久化一次）
    this.schedulePersist();

    return id;
  }

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(async () => {
      this.persistTimer = undefined;
      if (this.dirty && this.persistCallback) {
        this.dirty = false;
        try {
          await this.persistCallback([...this.entries]);
        } catch (err) {
          console.error("[AuditLog] persist failed:", err);
        }
      }
    }, 1000);
  }

  /** 查询审计日志（按筛选条件） */
  query(opts: {
    senderId?: string;
    groupId?: string;
    action?: string;
    category?: AuditActionCategory;
    result?: "success" | "denied" | "error";
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): AuditLogEntry[] {
    let results = this.entries;

    if (opts.senderId) {
      results = results.filter((e) => e.senderId === opts.senderId);
    }
    if (opts.groupId) {
      results = results.filter((e) => e.groupId === opts.groupId);
    }
    if (opts.action) {
      results = results.filter((e) => e.action === opts.action);
    }
    if (opts.category) {
      results = results.filter((e) => e.category === opts.category);
    }
    if (opts.result) {
      results = results.filter((e) => e.result === opts.result);
    }
    if (opts.startTime) {
      results = results.filter((e) => e.timestamp >= opts.startTime!);
    }
    if (opts.endTime) {
      results = results.filter((e) => e.timestamp <= opts.endTime!);
    }

    // 按时间倒序
    results = [...results].sort((a, b) => b.timestamp - a.timestamp);

    if (opts.limit) {
      results = results.slice(0, opts.limit);
    }

    return results;
  }

  /** 获取最近的 N 条审计日志 */
  recent(n = 50): AuditLogEntry[] {
    return [...this.entries].sort((a, b) => b.timestamp - a.timestamp).slice(0, n);
  }

  /** 获取某用户的审计统计 */
  statsByUser(senderId: string, since?: number): Record<string, number> {
    let entries = this.entries.filter((e) => e.senderId === senderId);
    if (since) {
      entries = entries.filter((e) => e.timestamp >= since);
    }
    const stats: Record<string, number> = {};
    for (const e of entries) {
      stats[e.action] = (stats[e.action] || 0) + 1;
    }
    return stats;
  }

  /** 获取总条数 */
  size(): number {
    return this.entries.length;
  }

  /** 清理指定时间之前的日志 */
  prune(beforeTimestamp: number): number {
    const before = this.entries.filter((e) => e.timestamp < beforeTimestamp).length;
    this.entries = this.entries.filter((e) => e.timestamp >= beforeTimestamp);
    return before;
  }
}

/** 全局审计日志实例 */
export const globalAuditLog = new AuditLogStore();

/**
 * 快速记录一次操作
 */
export function logAudit(
  entry: Omit<AuditLogEntry, "id" | "timestamp" | "isoTime">,
): string {
  return globalAuditLog.log(entry);
}

/**
 * 构造工具操作的审计日志参数（脱敏）
 */
export function sanitizeParams(params: Record<string, unknown>): string {
  const sensitiveKeys = ["accessToken", "token", "password", "secret", "authorization"];
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (sensitiveKeys.some((sk) => k.toLowerCase().includes(sk))) {
      sanitized[k] = "[REDACTED]";
    } else if (typeof v === "string" && v.length > 200) {
      sanitized[k] = v.slice(0, 200) + "...(truncated)";
    } else {
      sanitized[k] = v;
    }
  }
  return JSON.stringify(sanitized);
}

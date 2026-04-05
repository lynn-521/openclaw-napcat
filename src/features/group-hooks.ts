/**
 * src/features/group-hooks.ts
 * 群事件钩子（入群/退群/群解散等）
 * 支持事件触发时的自动化响应
 */

import type { OneBotSegment } from "../types.js";
import { textSegment } from "../api.js";

/** 群事件类型 */
export type GroupEventType = "group_increase" | "group_decrease" | "group_ban" | "group_recall";

/** 事件钩子动作 */
export type HookAction =
  | { type: "send_text"; text: string }
  | { type: "send_notice"; content: string }
  | { type: "execute_command"; command: string }
  | { type: "mute_member"; duration?: number }
  | { type: "kick_member" }
  | { type: "noop" };

export interface GroupHook {
  /** 钩子名称 */
  name: string;
  /** 监听的事件类型 */
  event: GroupEventType;
  /** 关联的群号列表（空=所有群） */
  groupIds: string[];
  /** 关联的机器人账号 */
  accountId?: string;
  /** 触发条件（可选） */
  condition?: {
    /** 只在特定角色加入时触发：owner | admin | member */
    role?: "owner" | "admin" | "member";
    /** 只在特定时间段触发（cron 表达式） */
    timeRange?: string;
  };
  /** 执行的动作 */
  action: HookAction;
  /** 是否启用 */
  enabled: boolean;
  /** 是否仅执行一次（触发后自动禁用） */
  once?: boolean;
  /** 描述 */
  description?: string;
}

export interface GroupEventContext {
  eventType: GroupEventType;
  groupId: string;
  userId: string;
  userName?: string;
  operatorId?: string; // 操作者（如 kick 是谁踢的）
  operatorName?: string;
  /** 退群原因 */
  reason?: string;
  /** 机器人自身 QQ 号 */
  selfId: string;
  /** 事件时间戳 */
  timestamp: number;
  /** 角色（入群时） */
  role?: "owner" | "admin" | "member";
  /** 是否为机器人自身的事件 */
  isSelf: boolean;
}

export interface GroupHookConfig {
  hooks: GroupHook[];
  /** 是否启用全局 */
  enabled: boolean;
  /** 默认入群欢迎消息（可设禁用） */
  defaultWelcome?: HookAction;
  /** 默认退群消息 */
  defaultLeave?: HookAction;
  /** 是否在管理员操作时发送通知 */
  adminNotify?: boolean;
}

/** 默认配置 */
export const DEFAULT_GROUP_HOOK_CONFIG: GroupHookConfig = {
  hooks: [],
  enabled: false,
  adminNotify: true,
};

/**
 * 入群事件通知（OneBot 11 结构）
 * 注意：OneBot 11 的 group_increase 事件来自 NapCat 的 notice 频道
 */
export interface OneBotGroupIncreaseEvent {
  post_type: "notice";
  notice_type: "group_increase";
  group_id: number;
  user_id: number;
  operator_id: number; // 审批人/邀请人
  time: number;
}

/**
 * 退群事件通知（OneBot 11 结构）
 */
export interface OneBotGroupDecreaseEvent {
  post_type: "notice";
  notice_type: "group_decrease";
  group_id: number;
  user_id: number;
  operator_id: number; // 操作者（如果是踢人）
  time: number;
  dismiss?: boolean; // 是否是群解散
}

/**
 * 解析 OneBot group_increase 事件
 */
export function parseGroupIncreaseEvent(
  raw: Record<string, unknown>,
): GroupEventContext | null {
  if (
    raw.post_type !== "notice" ||
    raw.notice_type !== "group_increase"
  ) {
    return null;
  }
  return {
    eventType: "group_increase",
    groupId: String(raw.group_id ?? ""),
    userId: String(raw.user_id ?? ""),
    operatorId: String(raw.operator_id ?? ""),
    timestamp: (raw.time as number) * 1000,
    isSelf: String(raw.user_id) === String(raw.self_id),
    role: (raw.sub_type as string) === "approve" ? "member" : "member",
  };
}

/**
 * 解析 OneBot group_decrease 事件
 */
export function parseGroupDecreaseEvent(
  raw: Record<string, unknown>,
): GroupEventContext | null {
  if (
    raw.post_type !== "notice" &&
    !(raw.post_type === "notice" && raw.notice_type === "group_decrease")
  ) {
    return null;
  }
  return {
    eventType: "group_decrease",
    groupId: String(raw.group_id ?? ""),
    userId: String(raw.user_id ?? ""),
    operatorId: String(raw.operator_id ?? ""),
    timestamp: (raw.time as number) * 1000,
    isSelf: String(raw.user_id) === String(raw.self_id),
    reason: raw.dismiss ? "群已解散" : undefined,
  };
}

/**
 * 群事件钩子引擎
 */
export class GroupHookEngine {
  private config: GroupHookConfig;
  private triggeredOnce = new Set<string>(); // name:groupId:userId

  constructor(rawConfig: GroupHookConfig) {
    this.config = { ...DEFAULT_GROUP_HOOK_CONFIG, ...rawConfig };
  }

  /** 热重载配置 */
  updateConfig(raw: GroupHookConfig): void {
    this.config = { ...this.config, ...raw };
  }

  /** 判断某事件是否应该触发钩子 */
  getMatchingHooks(event: GroupEventContext): GroupHook[] {
    if (!this.config.enabled) return [];

    return this.config.hooks.filter((hook) => {
      if (!hook.enabled) return false;
      if (hook.event !== event.eventType) return false;
      if (hook.groupIds.length > 0 && !hook.groupIds.includes(event.groupId)) return false;
      if (hook.accountId && hook.accountId !== "*") return undefined; // TODO: accountId 匹配

      // 条件过滤
      if (hook.condition?.role && event.role !== hook.condition.role) {
        return false;
      }

      // once 过滤：如果已经触发过，跳过
      const onceKey = `${hook.name}:${event.groupId}:${event.userId}`;
      if (hook.once && this.triggeredOnce.has(onceKey)) {
        return false;
      }

      return true;
    });
  }

  /**
   * 处理事件，返回应执行的动作
   */
  processEvent(
    event: GroupEventContext,
  ): Array<{ hook: GroupHook; action: HookAction }> {
    const matchingHooks = this.getMatchingHooks(event);
    const results: Array<{ hook: GroupHook; action: HookAction }> = [];

    for (const hook of matchingHooks) {
      // 执行 once 标记
      if (hook.once) {
        const onceKey = `${hook.name}:${event.groupId}:${event.userId}`;
        this.triggeredOnce.add(onceKey);
      }

      results.push({ hook, action: hook.action });
    }

    // 如果没有匹配到自定义钩子，检查默认欢迎/退群
    if (results.length === 0) {
      if (event.eventType === "group_increase" && this.config.defaultWelcome) {
        results.push({ hook: { name: "_default_welcome", event: "group_increase", groupIds: [], action: this.config.defaultWelcome, enabled: true, description: "默认欢迎" }, action: this.config.defaultWelcome });
      }
      if (event.eventType === "group_decrease" && this.config.defaultLeave) {
        results.push({ hook: { name: "_default_leave", event: "group_decrease", groupIds: [], action: this.config.defaultLeave, enabled: true, description: "默认欢送" }, action: this.config.defaultLeave });
      }
    }

    return results;
  }

  /**
   * 构造入群欢迎消息
   */
  buildWelcomeMessage(event: GroupEventContext, customText?: string): string {
    if (customText) {
      return customText
        .replace(/\{\{userName\}\}/g, event.userName ?? event.userId)
        .replace(/\{\{userId\}\}/g, event.userId)
        .replace(/\{\{groupId\}\}/g, event.groupId);
    }
    return `欢迎 ${event.userName ?? event.userId} 加入群聊 🎉`;
  }

  /**
   * 构造退群消息
   */
  buildLeaveMessage(event: GroupEventContext, customText?: string): string {
    if (customText) {
      return customText
        .replace(/\{\{userName\}\}/g, event.userName ?? event.userId)
        .replace(/\{\{userId\}\}/g, event.userId)
        .replace(/\{\{groupId\}\}/g, event.groupId)
        .replace(/\{\{reason\}\}/g, event.reason ?? "");
    }
    if (event.reason === "群已解散") {
      return `群已解散，${event.userName ?? event.userId} 离开了`;
    }
    return `${event.userName ?? event.userId} 离开了群聊 👋`;
  }

  /** 列出所有已配置的钩子 */
  listHooks(): GroupHook[] {
    return this.config.hooks.filter((h) => h.enabled);
  }

  /** 获取钩子统计 */
  stats(): { total: number; byEvent: Record<GroupEventType, number> } {
    const enabled = this.config.hooks.filter((h) => h.enabled);
    const byEvent: Record<GroupEventType, number> = {
      group_increase: 0,
      group_decrease: 0,
      group_ban: 0,
      group_recall: 0,
    };
    for (const h of enabled) {
      byEvent[h.event]++;
    }
    return { total: enabled.length, byEvent };
  }
}

/**
 * 将配置对象解析为 HookAction
 * 支持字符串简写："welcome" | "leave" | { type: "...", ... }
 */
export function parseHookAction(raw: unknown): HookAction | null {
  if (!raw) return null;

  if (typeof raw === "string") {
    switch (raw) {
      case "welcome":
        return { type: "send_text", text: "欢迎加入群聊 🎉" };
      case "leave":
        return { type: "send_text", text: "再见 👋" };
      case "noop":
        return { type: "noop" };
      default:
        return { type: "send_text", text: raw };
    }
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    switch (obj.type) {
      case "send_text":
        return { type: "send_text", text: String(obj.text ?? "") };
      case "send_notice":
        return { type: "send_notice", content: String(obj.content ?? "") };
      case "execute_command":
        return { type: "execute_command", command: String(obj.command ?? "") };
      case "mute_member":
        return { type: "mute_member", duration: Number(obj.duration ?? 600) };
      case "kick_member":
        return { type: "kick_member" };
      case "noop":
        return { type: "noop" };
    }
  }

  return null;
}

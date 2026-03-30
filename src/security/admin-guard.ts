/**
 * src/security/admin-guard.ts
 * 高危操作管理员权限守卫
 * 确保高危操作只有管理员才能执行
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { resolveNapCatAccount } from "../accounts.js";

/**
 * 高危操作等级
 * - L1 普通：白名单用户即可执行（发消息、查看资料等）
 * - L2 受限：白名单用户 + 非黑名单（禁言、踢人）
 * - L3 危险：必须管理员发起（全体禁言、改群名、发公告）
 * - L4 极危：必须明确管理员指令 + 二次确认（退出群、修改群头像）
 */
export type DangerLevel = "L1" | "L2" | "L3" | "L4";

/**
 * 操作权限定义
 */
export interface OperationPermission {
  /** 危险等级 */
  dangerLevel: DangerLevel;
  /** 是否需要 bot 管理员 */
  requireBotAdmin: boolean;
  /** 是否需要 QQ 群主/管理员角色 */
  requireGroupAdmin?: boolean;
  /** 是否需要明确的 user_confirm 确认 */
  requireUserConfirm?: boolean;
  /** 描述（用于审计日志） */
  description: string;
}

/** 工具名称 → 权限定义的映射 */
const PERMISSION_MAP: Record<string, OperationPermission> = {
  // L1 普通操作（不需要额外权限，白名单即可）
  qq_like_user: { dangerLevel: "L1", requireBotAdmin: false, description: "给用户点赞" },
  qq_get_user_info: { dangerLevel: "L1", requireBotAdmin: false, description: "获取用户资料" },
  qq_get_group_info: { dangerLevel: "L1", requireBotAdmin: false, description: "获取群信息" },
  qq_get_group_member_info: { dangerLevel: "L1", requireBotAdmin: false, description: "获取群成员资料" },
  qq_get_friend_list: { dangerLevel: "L1", requireBotAdmin: false, description: "获取好友列表" },
  qq_get_group_list: { dangerLevel: "L1", requireBotAdmin: false, description: "获取群列表" },
  qq_get_group_member_list: { dangerLevel: "L1", requireBotAdmin: false, description: "获取群成员列表" },
  qq_get_group_honor_info: { dangerLevel: "L1", requireBotAdmin: false, description: "获取群荣誉" },
  qq_get_group_msg_history: { dangerLevel: "L1", requireBotAdmin: false, description: "获取群消息历史" },
  qq_get_friend_msg_history: { dangerLevel: "L1", requireBotAdmin: false, description: "获取好友消息历史" },
  qq_get_essence_msg_list: { dangerLevel: "L1", requireBotAdmin: false, description: "获取精华消息列表" },
  qq_poke: { dangerLevel: "L1", requireBotAdmin: false, description: "戳一戳" },
  qq_get_group_at_all_remain: { dangerLevel: "L1", requireBotAdmin: false, description: "查询@全体成员剩余次数" },
  qq_ocr_image: { dangerLevel: "L1", requireBotAdmin: false, description: "OCR图片识别" },
  qq_translate_en2zh: { dangerLevel: "L1", requireBotAdmin: false, description: "英译中" },
  qq_mark_msg_as_read: { dangerLevel: "L1", requireBotAdmin: false, description: "标记消息已读" },
  qq_get_group_root_files: { dangerLevel: "L1", requireBotAdmin: false, description: "获取群文件列表" },
  qq_get_group_file_url: { dangerLevel: "L1", requireBotAdmin: false, description: "获取群文件下载链接" },
  qq_set_group_sign: { dangerLevel: "L1", requireBotAdmin: false, description: "群签到" },

  // L2 受限操作（需要白名单，且某些需要群管理员身份）
  qq_mute_group_member: {
    dangerLevel: "L2",
    requireBotAdmin: false,
    requireGroupAdmin: true,
    description: "禁言群成员",
  },
  qq_kick_group_member: {
    dangerLevel: "L2",
    requireBotAdmin: false,
    requireGroupAdmin: true,
    description: "踢出群成员",
  },
  qq_recall_message: {
    dangerLevel: "L2",
    requireBotAdmin: false,
    requireGroupAdmin: true,
    description: "撤回消息",
  },
  qq_set_msg_emoji_like: { dangerLevel: "L1", requireBotAdmin: false, description: "消息表情回应" },

  // L3 危险操作（必须管理员）
  qq_set_group_admin: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "设置/取消群管理员",
  },
  qq_set_group_name: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "修改群名称",
  },
  qq_set_group_whole_ban: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "全员禁言开关",
  },
  qq_send_group_notice: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "发送群公告",
  },
  qq_delete_group_notice: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "删除群公告",
  },
  qq_set_group_card: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "设置群名片",
  },
  qq_set_group_special_title: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "设置群成员专属头衔",
  },
  qq_set_group_portrait: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "设置群头像",
  },
  qq_create_group_file_folder: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "创建群文件夹",
  },
  qq_delete_group_file: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "删除群文件",
  },
  qq_handle_friend_request: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    description: "处理好友请求",
  },
  qq_handle_group_request: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "处理加群请求",
  },
  qq_set_group_remark: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    description: "设置群备注",
  },
  qq_delete_group_notice: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "删除群公告",
  },
  qq_send_group_forward_msg: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    description: "发送群合并转发",
  },
  qq_send_private_forward_msg: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    description: "发送私聊合并转发",
  },

  // L4 极危操作（管理员 + 二次确认）
  qq_set_group_leave: {
    dangerLevel: "L4",
    requireBotAdmin: true,
    requireGroupAdmin: true,
    requireUserConfirm: true,
    description: "退出群聊",
  },
  qq_delete_friend: {
    dangerLevel: "L4",
    requireBotAdmin: true,
    requireUserConfirm: true,
    description: "删除好友",
  },
  qq_set_friend_remark: {
    dangerLevel: "L2",
    requireBotAdmin: true,
    description: "设置好友备注",
  },
  qq_upload_file: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    description: "上传文件",
  },
  qq_download_file: {
    dangerLevel: "L3",
    requireBotAdmin: true,
    description: "下载文件",
  },
  qq_send_message: {
    dangerLevel: "L1",
    requireBotAdmin: false,
    description: "发送消息",
  },
  qq_forward_message: {
    dangerLevel: "L2",
    requireBotAdmin: true,
    description: "转发消息",
  },
  qq_set_essence_msg: {
    dangerLevel: "L2",
    requireBotAdmin: false,
    requireGroupAdmin: true,
    description: "设置精华消息",
  },
  qq_delete_essence_msg: {
    dangerLevel: "L2",
    requireBotAdmin: false,
    requireGroupAdmin: true,
    description: "移除精华消息",
  },
};

/**
 * 获取工具的权限定义
 */
export function getOperationPermission(toolName: string): OperationPermission | null {
  return PERMISSION_MAP[toolName] ?? null;
}

/**
 * 获取工具的危险等级
 */
export function getDangerLevel(toolName: string): DangerLevel {
  return PERMISSION_MAP[toolName]?.dangerLevel ?? "L1";
}

/**
 * 检查是否需要管理员
 */
export function requiresAdmin(toolName: string): boolean {
  return PERMISSION_MAP[toolName]?.requireBotAdmin ?? false;
}

/**
 * 检查是否需要群管理员角色
 */
export function requiresGroupAdmin(toolName: string): boolean {
  return PERMISSION_MAP[toolName]?.requireGroupAdmin ?? false;
}

/**
 * 检查是否需要用户二次确认
 */
export function requiresUserConfirm(toolName: string): boolean {
  return PERMISSION_MAP[toolName]?.requireUserConfirm ?? false;
}

/**
 * 获取配置中定义的机器人管理员 QQ 列表
 */
export function getBotAdmins(cfg: OpenClawConfig): string[] {
  try {
    const account = resolveNapCatAccount({ cfg });
    const admins = account.config.admins;
    if (Array.isArray(admins)) {
      return admins.map((v) => String(v));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * 检查某个 QQ 号是否为机器人管理员
 */
export function isBotAdmin(cfg: OpenClawConfig, senderId: string | number): boolean {
  const admins = getBotAdmins(cfg);
  return admins.includes(String(senderId));
}

/**
 * 权限检查结果
 */
export interface GuardResult {
  allowed: boolean;
  reason?: string;
  /** 需要用户二次确认（L4 操作） */
  requiresUserConfirm?: boolean;
  /** 需要管理员权限 */
  requiresAdmin?: boolean;
  /** 需要群管理员身份 */
  requiresGroupAdmin?: boolean;
}

/**
 * 执行权限守卫检查
 * @param toolName 工具名称
 * @param senderId 发起操作的 QQ 号
 * @param senderRole 发送者在群中的角色（owner/admin/member）
 * @param cfg OpenClaw 配置
 * @param userConfirm 是否已获得用户确认标记
 */
export function checkPermission(
  toolName: string,
  senderId: string | number,
  senderRole?: "owner" | "admin" | "member",
  cfg?: OpenClawConfig,
  userConfirm = false,
): GuardResult {
  const permission = getOperationPermission(toolName);
  if (!permission) {
    // 未知工具，默认放行（由 ownerOnly 标志控制）
    return { allowed: true };
  }

  // L4 操作需要用户确认标记
  if (permission.requireUserConfirm && !userConfirm) {
    return {
      allowed: false,
      reason: `危险操作 [${permission.description}] 需要你明确回复"确认"才能执行`,
      requiresUserConfirm: true,
    };
  }

  // L3/L4 操作需要管理员权限
  if (permission.requireBotAdmin && cfg) {
    if (!isBotAdmin(cfg, senderId)) {
      return {
        allowed: false,
        reason: `[${permission.description}] 需要机器人管理员权限，你的 QQ 号 ${senderId} 不在管理员列表中`,
        requiresAdmin: true,
      };
    }
  }

  // 部分操作需要群管理员身份（owner 或 admin）
  if (permission.requireGroupAdmin) {
    if (senderRole !== "owner" && senderRole !== "admin") {
      return {
        allowed: false,
        reason: `[${permission.description}] 需要群主或管理员身份才能执行`,
        requiresGroupAdmin: true,
      };
    }
  }

  return { allowed: true };
}

/**
 * L4 操作的白名单确认标记列表
 * key: `${senderId}:${toolName}`
 * value: confirmToken（简化的确认机制）
 */
const pendingConfirmations = new Map<string, { token: string; expiresAt: number }>();

/**
 * 生成待确认的 L4 操作
 */
export function createPendingConfirmation(
  senderId: string,
  toolName: string,
  targetId: string,
): string {
  const key = `${senderId}:${toolName}:${targetId}`;
  const token = `confirm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  pendingConfirmations.set(key, {
    token,
    expiresAt: Date.now() + 5 * 60_000, // 5 分钟过期
  });
  // 清理过期项
  for (const [k, v] of pendingConfirmations) {
    if (Date.now() > v.expiresAt) pendingConfirmations.delete(k);
  }
  return token;
}

/**
 * 验证并消费确认 token
 */
export function consumeConfirmation(
  senderId: string,
  toolName: string,
  targetId: string,
  token: string,
): boolean {
  const key = `${senderId}:${toolName}:${targetId}`;
  const entry = pendingConfirmations.get(key);
  if (!entry) return false;
  if (entry.token !== token) return false;
  if (Date.now() > entry.expiresAt) {
    pendingConfirmations.delete(key);
    return false;
  }
  pendingConfirmations.delete(key);
  return true;
}

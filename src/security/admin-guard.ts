/**
 * Admin guard for NapCat channel.
 * Blocks high-risk operations unless the triggering user is in the admins list.
 */

import type { NapCatAccountConfig } from "../types.js";

/** Tools that require admin permission. */
export const HIGH_RISK_TOOLS: Record<string, true> = {
  qq_mute_group_member: true,
  qq_kick_group_member: true,
  qq_set_group_admin: true,
  qq_set_group_name: true,
  qq_set_group_whole_ban: true,
  qq_set_group_leave: true,
  qq_send_group_notice: true,
  qq_delete_group_notice: true,
  qq_set_essence_msg: true,
  qq_delete_essence_msg: true,
  qq_handle_friend_request: true,
  qq_handle_group_request: true,
  qq_delete_friend: true,
  qq_set_friend_remark: true,
};

export type HighRiskToolName = keyof typeof HIGH_RISK_TOOLS;

/** Check if a tool name is a high-risk tool. */
export function isHighRiskTool(name: string): name is HighRiskToolName {
  return name in HIGH_RISK_TOOLS;
}

export class AdminGuard {
  private readonly admins = new Set<string>();

  constructor(cfg: NapCatAccountConfig) {
    for (const a of cfg.admins ?? []) {
      this.admins.add(String(a));
    }
  }

  /**
   * Returns an error message string if denied, or null if allowed.
   * @param senderId - QQ number of the message sender
   */
  check(senderId: number): string | null {
    if (this.admins.size === 0) return null; // No admins configured, allow all
    if (this.admins.has(String(senderId))) return null;
    return `⛔ 此操作需要管理员权限。你的 QQ号 ${senderId} 不在管理员列表中。`;
  }

  /** Check if a specific sender is an admin. */
  isAdmin(senderId: number): boolean {
    return this.admins.has(String(senderId));
  }
}

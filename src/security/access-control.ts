import type { NapCatAccountConfig } from "../types.js";

/**
 * Check if a sender is allowed to interact based on whitelist / blacklist configuration.
 *
 * Logic:
 * - If whitelist.enabled = false → always allowed (no restriction)
 * - If whitelist.mode = "allowlist" → sender must be in allowUsers or group in allowGroups
 * - If whitelist.mode = "blocklist" → sender must NOT be in blockUsers AND group must NOT be in blockGroups
 *
 * @param senderId  The sender's QQ number as a string.
 * @param groupId   The group ID (only for group messages).
 * @param config   The account configuration.
 * @returns { allowed: boolean; reason?: string }
 */
export function checkAccess(
  senderId: string,
  groupId: string | undefined,
  config: NapCatAccountConfig,
): { allowed: boolean; reason?: string } {
  const wl = config.whitelist;

  // If not enabled, no restriction applies
  if (!wl?.enabled) {
    return { allowed: true };
  }

  const mode = wl.mode ?? "blocklist";
  const allowUsers = (wl.allowUsers ?? []).map((v) => String(v));
  const allowGroups = (wl.allowGroups ?? []).map((v) => String(v));
  const blockUsers = (wl.blockUsers ?? []).map((v) => String(v));
  const blockGroups = (wl.blockGroups ?? []).map((v) => String(v));

  if (mode === "allowlist") {
    // In allowlist mode, the sender must appear in the user allow list
    // and (if in a group) the group must appear in the group allow list.
    const userAllowed = allowUsers.length === 0 || allowUsers.includes(senderId);
    if (!userAllowed) {
      return { allowed: false, reason: "您不在白名单中，暂时无法使用本机器人。" };
    }
    if (groupId !== undefined) {
      const groupAllowed = allowGroups.length === 0 || allowGroups.includes(groupId);
      if (!groupAllowed) {
        return { allowed: false, reason: "此群不在白名单中，暂时无法使用本机器人。" };
      }
    }
    return { allowed: true };
  }

  // blocklist mode (default)
  const userBlocked = blockUsers.includes(senderId);
  if (userBlocked) {
    return { allowed: false, reason: "您已被禁止使用本机器人。" };
  }
  if (groupId !== undefined && blockGroups.includes(groupId)) {
    return { allowed: false, reason: "此群已被禁止使用本机器人。" };
  }

  return { allowed: true };
}

import type { NapCatAccountConfig, OneBotNoticeEvent } from "../types.js";

export interface GroupEventContext {
  eventType: "group_increase" | "group_decrease";
  groupId: string;
  userId: string;
  operatorId?: string;
  nickname?: string;
  selfId: string;
  timestamp: number;
}

/**
 * Replace placeholders in a message template.
 * Supports: {nickname}, {user_id}
 */
function renderTemplate(
  template: string,
  nickname?: string,
  userId?: string,
): string {
  return template
    .replace(/\{nickname\}/g, nickname ?? "新成员")
    .replace(/\{user_id\}/g, userId ?? "");
}

/**
 * Check if the operator is a group admin or owner.
 * For group_decrease events, the operator who kicked someone is the admin.
 * We rely on the config's adminOnly flag for authorization.
 */
function isOperatorAdmin(
  operatorId: string | undefined,
  config: NapCatAccountConfig,
): boolean {
  if (!operatorId) return false;
  const admins = (config.admins ?? []).map((v) => String(v));
  return admins.includes(operatorId);
}

/**
 * Handle group member join event (group_increase).
 * Sends a welcome message if configured.
 */
export async function handleGroupIncrease(
  event: OneBotNoticeEvent,
  config: NapCatAccountConfig,
  sendFn: (target: string, text: string) => Promise<void>,
): Promise<void> {
  const groupEvents = config.groupEvents;
  if (!groupEvents?.onJoin?.enabled) return;

  const { onJoin } = groupEvents;
  const { welcomeMessage, atNewMember = true } = onJoin;

  // If adminOnly is set, skip (admin-only triggers are handled elsewhere)
  if (onJoin.adminOnly) return;

  if (!welcomeMessage) return;

  const groupId = String(event.group_id);
  const userId = String(event.user_id);
  const nickname = event.operator_id !== undefined ? String(event.operator_id) : undefined;

  const message = atNewMember
    ? renderTemplate(welcomeMessage, nickname, userId).replace(/\{nickname\}/, `@${userId}`)
    : renderTemplate(welcomeMessage, nickname, userId);

  await sendFn(groupId, message);
}

/**
 * Handle group member leave event (group_decrease).
 * Sends a farewell message if configured.
 */
export async function handleGroupDecrease(
  event: OneBotNoticeEvent,
  config: NapCatAccountConfig,
  sendFn: (target: string, text: string) => Promise<void>,
): Promise<void> {
  const groupEvents = config.groupEvents;
  if (!groupEvents?.onLeave?.enabled) return;

  const { farewellMessage } = groupEvents.onLeave;
  if (!farewellMessage) return;

  const groupId = String(event.group_id);
  const userId = String(event.user_id);
  const operatorId = event.operator_id !== undefined ? String(event.operator_id) : undefined;

  const message = renderTemplate(farewellMessage, undefined, userId);
  await sendFn(groupId, message);
}

/**
 * Dispatch a notice event to the appropriate handler.
 */
export async function handleGroupNoticeEvent(
  event: OneBotNoticeEvent,
  config: NapCatAccountConfig,
  sendFn: (target: string, text: string) => Promise<void>,
): Promise<void> {
  if (event.notice_type === "group_increase") {
    await handleGroupIncrease(event, config, sendFn);
  } else if (event.notice_type === "group_decrease") {
    await handleGroupDecrease(event, config, sendFn);
  }
}

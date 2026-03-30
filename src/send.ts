import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { resolveNapCatAccount } from "./accounts.js";
import {
  sendPrivateMsg,
  sendGroupMsg,
  textSegment,
  imageSegment,
  replySegment,
} from "./api.js";
import type { OneBotSegment } from "./types.js";
import {
  isNapCatWsConnected,
  wsSendPrivateMsg,
  wsSendGroupMsg,
} from "./ws-client.js";
import { handleLongMessage, sendForwardMsgHttp } from "./features/long-message.js";

export type NapCatSendOptions = {
  httpApi?: string;
  accessToken?: string;
  accountId?: string;
  cfg?: OpenClawConfig;
  mediaUrl?: string;
  /** 传入此消息ID则所有发送的消息都会带上 reply 段（保持对话上下文） */
  replyToMessageId?: number | string;
  /** 长消息配置（默认自动读取 cfg） */
  longMessage?: {
    threshold?: number;
    mode?: "normal" | "og_image" | "forward";
    normal?: { flushIntervalMs?: number; flushChars?: number };
    ogImage?: { renderTheme?: string; fontSize?: number };
  };
};

export type NapCatSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

const QQ_TEXT_LIMIT = 4500;

function resolveSendContext(options: NapCatSendOptions): {
  httpApi: string;
  accessToken: string;
} {
  if (options.cfg) {
    const account = resolveNapCatAccount({
      cfg: options.cfg,
      accountId: options.accountId,
    });
    return {
      httpApi: options.httpApi || account.httpApi,
      accessToken: options.accessToken || account.accessToken,
    };
  }
  return {
    httpApi: options.httpApi ?? "",
    accessToken: options.accessToken ?? "",
  };
}

/**
 * Send a message to a QQ user or group.
 * Target format: "private:<userId>" or "group:<groupId>"
 *
 * Prefers WebSocket for sending; falls back to HTTP API if WS is unavailable.
 * When the message exceeds the longMessage threshold, delegates to handleLongMessage.
 */
export async function sendMessageNapCat(
  target: string,
  text: string,
  options: NapCatSendOptions = {},
): Promise<NapCatSendResult> {
  const { httpApi, accessToken } = resolveSendContext(options);

  const trimmedTarget = target?.trim();
  if (!trimmedTarget) {
    return { ok: false, error: "No target provided" };
  }

  // Resolve longMessage config: options take precedence over cfg
  const lmCfg = resolveLongMessageConfig(options);

  // ── Long message check ────────────────────────────────────────────────────
  if (lmCfg && text.length > lmCfg.threshold) {
    const replyTo = options.replyToMessageId;
    await handleLongMessage(
      text,
      trimmedTarget,
      {
        mode: lmCfg.mode,
        threshold: lmCfg.threshold,
        config: {
          flushIntervalMs: lmCfg.normal?.flushIntervalMs,
          flushChars: lmCfg.normal?.flushChars,
          renderTheme: lmCfg.ogImage?.renderTheme,
          fontSize: lmCfg.ogImage?.fontSize,
        },
      },
      // sendFn: called per-chunk by handleLongMessage
      async (t, msg) => {
        const isG = t.startsWith("group:");
        const tid = Number(t.replace(/^(private|group):/, ""));
        const segs: OneBotSegment[] = [];
        if (replyTo != null) segs.push(replySegment(String(replyTo)));
        segs.push(textSegment(msg.slice(0, QQ_TEXT_LIMIT)));

        if (isNapCatWsConnected()) {
          try {
            await (isG ? wsSendGroupMsg(tid, segs) : wsSendPrivateMsg(tid, segs));
            return;
          } catch (wsErr) {
            console.warn(`[NapCat] long-msg chunk WS failed, falling through: ${String(wsErr)}`);
          }
        }
        if (httpApi) {
          await (isG
            ? sendGroupMsg(httpApi, tid, segs, accessToken)
            : sendPrivateMsg(httpApi, tid, segs, accessToken));
        }
      },
    );
    return { ok: true };
  }

  // ── Short / normal path ───────────────────────────────────────────────────
  const segments: OneBotSegment[] = [];

  if (options.mediaUrl?.trim()) {
    segments.push(imageSegment(options.mediaUrl.trim()));
  }
  if (text?.trim()) {
    segments.push(textSegment(text.slice(0, QQ_TEXT_LIMIT)));
  }
  if (options.replyToMessageId != null) {
    segments.unshift(replySegment(String(options.replyToMessageId)));
  }
  if (segments.length === 0) {
    return { ok: false, error: "Empty message" };
  }

  try {
    const isGroup = trimmedTarget.startsWith("group:");
    const id = Number(trimmedTarget.replace(/^(private|group):/, ""));

    if (Number.isNaN(id)) {
      return { ok: false, error: `Invalid target ID: ${trimmedTarget}` };
    }

    // Try WS first
    if (isNapCatWsConnected()) {
      try {
        const result = isGroup
          ? await wsSendGroupMsg(id, segments)
          : await wsSendPrivateMsg(id, segments);
        return { ok: true, messageId: String(result.message_id) };
      } catch (wsErr) {
        console.warn(`[NapCat] WS send failed, falling back to HTTP: ${String(wsErr)}`);
      }
    } else if (!httpApi) {
      return { ok: false, error: "WS not connected and no HTTP API configured" };
    }

    // HTTP fallback
    const result = isGroup
      ? await sendGroupMsg(httpApi, id, segments, accessToken)
      : await sendPrivateMsg(httpApi, id, segments, accessToken);

    return { ok: true, messageId: String(result.message_id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// longMessage config resolver — merges cfg defaults with options overrides
// ---------------------------------------------------------------------------

interface ResolvedLongMessageConfig {
  threshold: number;
  mode: "normal" | "og_image" | "forward";
  normal: { flushIntervalMs: number; flushChars: number };
  ogImage: { renderTheme: string; fontSize: number };
}

function resolveLongMessageConfig(
  options: NapCatSendOptions,
): ResolvedLongMessageConfig | null {
  const raw = options.longMessage;
  // If explicitly disabled or not provided, skip
  if (!raw) {
    // Try to read from cfg if available (account-level config)
    const cfg = options.cfg;
    const lmFromCfg = cfg && typeof cfg === "object"
      ? (cfg as Record<string, unknown>).longMessage as
        | Record<string, unknown>
        | undefined
      : undefined;
    if (!lmFromCfg) return null;
    return normalizeLmCfg(lmFromCfg as Record<string, unknown>);
  }
  return normalizeLmCfg(raw as Record<string, unknown>);
}

function normalizeLmCfg(
  raw: Record<string, unknown>,
): ResolvedLongMessageConfig {
  const normal = (raw.normal as Record<string, unknown>) ?? {};
  const ogImage = (raw.ogImage as Record<string, unknown>) ?? {};
  return {
    threshold: (raw.threshold as number) ?? 300,
    mode: (raw.mode as "normal" | "og_image" | "forward") ?? "normal",
    normal: {
      flushIntervalMs: (normal.flushIntervalMs as number) ?? 1200,
      flushChars: (normal.flushChars as number) ?? 160,
    },
    ogImage: {
      renderTheme: (ogImage.renderTheme as string) ?? "default",
      fontSize: (ogImage.fontSize as number) ?? 14,
    },
  };
}

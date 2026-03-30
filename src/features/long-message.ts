/**
 * Long message handler — three strategies to avoid flooding or truncation.
 *
 * - normal  : split into chunks, send with flushIntervalMs delay between each
 * - og_image: render text as HTML, convert to image, send as picture
 * - forward : send as a merged forward message
 */

import { callOneBotApi } from "../api.js";
import type { NapCatSegment } from "../api.js";
import {
  isNapCatWsConnected,
  wsCallApi,
  wsSendGroupMsg,
  wsSendPrivateMsg,
} from "../ws-client.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LongMessageMode = "normal" | "og_image" | "forward";

export interface LongMessageOptions {
  mode: LongMessageMode;
  threshold: number;
  config: {
    flushIntervalMs?: number;
    flushChars?: number;
    renderTheme?: string;
    fontSize?: number;
  };
}

// ---------------------------------------------------------------------------
// og_image helpers — build HTML, render via canvas
// ---------------------------------------------------------------------------

const THEME_CSS: Record<string, { bg: string; text: string; code: string }> = {
  default: { bg: "#ffffff", text: "#1f1f1f", code: "#f6f8fa" },
  dark: { bg: "#0d1117", text: "#e6edf3", code: "#161b22" },
};

function buildHtml(text: string, theme: string, fontSize: number): string {
  const c = THEME_CSS[theme] ?? THEME_CSS["default"];
  // Escape HTML entities
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: ${c.bg};
    color: ${c.text};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: ${fontSize}px;
    line-height: 1.8;
    padding: 32px;
    max-width: 800px;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
</head>
<body>${escaped}</body>
</html>`;
}

/**
 * Render text to a PNG buffer using the `canvas` API (via @napi-rs/canvas).
 * Returns null if @napi-rs/canvas is not installed or rendering fails.
 * The caller will fall back to normal mode on null.
 */
async function htmlToImageBuffer(
  text: string,
  theme: string,
  fontSize: number,
  width = 800,
): Promise<Buffer | null> {
  try {
    const { createCanvas } = await import("@napi-rs/canvas");

    // Pre-measure: estimate height based on character count and line length
    const charsPerLine = Math.floor(width * 0.85 / (fontSize * 0.6));
    const lineCount = Math.ceil(text.length / charsPerLine);
    const lineHeight = Math.round(fontSize * 1.8);
    const height = Math.max(lineCount * lineHeight + 64, 200);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const c = theme === "dark"
      ? { bg: "#0d1117", text: "#e6edf3" }
      : { bg: "#ffffff", text: "#1f1f1f" };

    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = c.text;
    ctx.textBaseline = "top";

    // Word-wrap manually
    const paragraphs = text.split("\n");
    let y = 24;
    for (const para of paragraphs) {
      if (para.trim() === "") { y += lineHeight; continue; }
      // Wrap long lines
      let pos = 0;
      while (pos < para.length) {
        const slice = para.slice(pos, pos + charsPerLine);
        ctx.fillText(slice, 20, y);
        pos += charsPerLine;
        y += lineHeight;
      }
    }

    return canvas.toBuffer("image/png") as unknown as Buffer;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Forward helpers
// ---------------------------------------------------------------------------

/** Split text into chunks of up to `size` characters. */
function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

/** Build a forward message node for send_(group|private)_forward_msg. */
function buildForwardNode(
  content: string,
  senderName = "AI 助手",
  uin = "10000",
): NapCatSegment {
  return {
    type: "node",
    data: {
      name: senderName,
      uin,
      content: JSON.stringify([{ type: "text", data: { text: content } }]),
    },
  } as unknown as NapCatSegment;
}

// ---------------------------------------------------------------------------
// Core handler
// ---------------------------------------------------------------------------

/**
 * Handle a long message according to the configured mode.
 *
 * @param text     Full message text
 * @param target   "private:<userId>" or "group:<groupId>"
 * @param options  Long message options (mode, threshold, config)
 * @param sendFn   Low-level sender: (target, text) => Promise<void>
 */
export async function handleLongMessage(
  text: string,
  target: string,
  options: LongMessageOptions,
  sendFn: (target: string, text: string) => Promise<void>,
): Promise<void> {
  const { mode, config } = options;
  const isGroup = target.startsWith("group:");

  switch (mode) {
    case "normal":
      await handleNormalMode(text, target, config, sendFn);
      break;

    case "og_image":
      await handleOgImageMode(text, target, isGroup, config);
      break;

    case "forward":
      await handleForwardMode(text, target, isGroup, config);
      break;

    default:
      // Fallback to normal
      await handleNormalMode(text, target, config, sendFn);
  }
}

// ---------------------------------------------------------------------------
// Mode: normal — flush chunks with interval
// ---------------------------------------------------------------------------

async function handleNormalMode(
  text: string,
  target: string,
  config: LongMessageOptions["config"],
  sendFn: (target: string, text: string) => Promise<void>,
): Promise<void> {
  const flushChars = config.flushChars ?? 160;
  const flushIntervalMs = config.flushIntervalMs ?? 1200;

  const chunks = chunkText(text, flushChars);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    // Add continuation marker for multi-chunk messages
    const labelled =
      chunks.length > 1 ? `[${i + 1}/${chunks.length}]\n${chunk}` : chunk;

    await sendFn(target, labelled);

    if (i < chunks.length - 1 && flushIntervalMs > 0) {
      await sleep(flushIntervalMs);
    }
  }
}

// ---------------------------------------------------------------------------
// Mode: og_image — render HTML to image and send
// ---------------------------------------------------------------------------

async function handleOgImageMode(
  text: string,
  target: string,
  isGroup: boolean,
  config: LongMessageOptions["config"],
): Promise<void> {
  const theme = config.renderTheme ?? "default";
  const fontSize = config.fontSize ?? 14;

  const imageBuffer = await htmlToImageBuffer(text, theme, fontSize);

  if (!imageBuffer) {
    // Fallback to normal mode if rendering fails
    console.warn("[NapCat] og_image render failed, falling back to normal mode");
    await handleNormalMode(text, target, config, async (t, msg) => {
      throw new Error("og_image fallback requires sendFn — caller should handle");
    });
    return;
  }

  // Save buffer to temp file and send as image
  const tmpPath = `/tmp/napcat_longmsg_${Date.now()}.png`;
  const { writeFile } = await import("fs/promises");
  await writeFile(tmpPath, imageBuffer);

  const segments: NapCatSegment[] = [{ type: "image", data: { file: tmpPath } }];

  if (isNapCatWsConnected()) {
    const id = Number(target.replace(/^(private|group):/, ""));
    if (isGroup) {
      await wsSendGroupMsg(id, segments);
    } else {
      await wsSendPrivateMsg(id, segments);
    }
  } else {
    // og_image mode requires WS or a file path on the napcat server
    console.error("[NapCat] og_image mode requires WS connection");
  }
}

// ---------------------------------------------------------------------------
// Mode: forward — merged forward message
// ---------------------------------------------------------------------------

async function handleForwardMode(
  text: string,
  target: string,
  isGroup: boolean,
  config: LongMessageOptions["config"],
): Promise<void> {
  const flushChars = config.flushChars ?? 300;
  const chunks = chunkText(text, flushChars);

  const nodes = chunks.map((chunk) => buildForwardNode(chunk));

  if (isNapCatWsConnected()) {
    const id = Number(target.replace(/^(private|group):/, ""));
    await wsCallApi(isGroup ? "send_group_forward_msg" : "send_private_forward_msg", {
      [isGroup ? "group_id" : "user_id"]: id,
      messages: nodes,
    });
  } else {
    // HTTP fallback via callOneBotApi — but we need httpApi/accessToken
    // which we don't have here. The caller (send.ts) provides these via
    // the options, so we expose a helper that accepts them.
    throw new Error(
      "forward mode via HTTP requires httpApi/accessToken — use sendMessageNapCat directly",
    );
  }
}

/**
 * Send a forward message via HTTP API (used by send.ts when WS is unavailable).
 */
export async function sendForwardMsgHttp(
  target: string,
  messages: NapCatSegment[],
  httpApi: string,
  accessToken?: string,
): Promise<void> {
  const isGroup = target.startsWith("group:");
  const id = Number(target.replace(/^(private|group):/, ""));

  await callOneBotApi(
    isGroup ? "send_group_forward_msg" : "send_private_forward_msg",
    httpApi,
    {
      [isGroup ? "group_id" : "user_id"]: id,
      messages,
    },
    { accessToken },
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

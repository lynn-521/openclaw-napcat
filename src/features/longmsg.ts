/**
 * src/features/longmsg.ts
 * 长消息处理策略
 * 支持三种模式：normal / og_image / forward
 *
 * - normal: 流式边生成边发送（ChatML 场景，逐段发送）
 * - og_image: HTML 模板渲染后转图片发送（长内容富文本）
 * - forward: 合并转发消息（超长纯文本）
 */

import type { OneBotSegment } from "../types.js";

/** 长消息处理模式 */
export type LongMessageMode = "normal" | "og_image" | "forward";

/** 流式消息块 */
export interface StreamChunk {
  text: string;
  isFinal: boolean;
}

/** 长消息处理配置 */
export interface LongMessageConfig {
  /** 触发阈值（字符数），超过此值启用长消息策略 */
  threshold: number;
  /** 处理模式 */
  mode: LongMessageMode;
  /** normal 模式：每次 flush 的字符数 */
  normalFlushChars: number;
  /** normal 模式：每次 flush 间隔（毫秒） */
  normalFlushIntervalMs: number;
  /** og_image 模式：HTML 渲染主题 */
  ogImageTheme: "default" | "elegant" | "compact" | "code";
  /** og_image 模式：最大图片宽度 */
  ogImageMaxWidth: number;
  /** forward 模式：每条消息最大字符数 */
  forwardChunkSize: number;
  /** forward 模式：每条消息之间的时间间隔（毫秒） */
  forwardIntervalMs: number;
}

export const DEFAULT_LONGMSG_CONFIG: LongMessageConfig = {
  threshold: 300,
  mode: "normal",
  normalFlushChars: 160,
  normalFlushIntervalMs: 1200,
  ogImageTheme: "default",
  ogImageMaxWidth: 800,
  forwardChunkSize: 2000,
  forwardIntervalMs: 500,
};

/** OG Image HTML 模板 */
function buildOgHtml(template: {
  content: string;
  theme: "default" | "elegant" | "compact" | "code";
  title?: string;
  maxWidth: number;
}): string {
  const themeStyles: Record<string, string> = {
    default: `
      background: #1a1a2e;
      color: #e0e0e0;
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 15px;
      line-height: 1.7;
      padding: 24px;
    `,
    elegant: `
      background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%);
      color: #c8d6e5;
      font-family: "Songti SC", "SimSun", serif;
      font-size: 16px;
      line-height: 2;
      padding: 32px;
    `,
    compact: `
      background: #2d2d2d;
      color: #b0b0b0;
      font-family: "Courier New", monospace;
      font-size: 13px;
      line-height: 1.5;
      padding: 16px;
    `,
    code: `
      background: #1e1e1e;
      color: #d4d4d4;
      font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
      font-size: 14px;
      line-height: 1.6;
      padding: 20px;
    `,
  };

  const style = themeStyles[template.theme] ?? themeStyles.default;

  // 处理代码块高亮（简化处理）
  const content = escapeHtml(template.content)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre style="background:#0d0d0d;border-radius:8px;padding:16px;overflow-x:auto;border:1px solid #333"><code>${code.trim()}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, '<code style="background:#333;border-radius:3px;padding:2px 6px">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#fff">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { ${style} word-break: break-word; max-width: ${template.maxWidth}px; }
h1 { font-size: 1.3em; margin-bottom: 16px; color: #fff; border-bottom: 1px solid #333; padding-bottom: 8px; }
h2 { font-size: 1.1em; margin: 12px 0; color: #a0d8ef; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; }
td, th { border: 1px solid #333; padding: 6px 10px; }
blockquote { border-left: 3px solid #4a90d9; padding-left: 12px; margin: 8px 0; color: #9cb2c4; }
</style>
</head>
<body>
${template.title ? `<h1>${escapeHtml(template.title)}</h1>` : ""}
<div>${content}</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 将长文本拆分为 forward 模式的消息节点
 */
export function buildForwardNodes(
  text: string,
  cfg: LongMessageConfig,
): Array<{ type: "node"; data: { name: string; uin: string; content: OneBotSegment[] } }> {
  const nodes: Array<{
    type: "node";
    data: { name: string; uin: string; content: OneBotSegment[] };
  }> = [];
  const chunkSize = cfg.forwardChunkSize;
  let remaining = text;

  while (remaining.length > 0) {
    const chunk = remaining.slice(0, chunkSize);
    remaining = remaining.slice(chunkSize);
    nodes.push({
      type: "node",
      data: {
        name: "AI Assistant",
        uin: "0",
        content: [{ type: "text", data: { text: chunk } }],
      },
    });
  }

  return nodes;
}

/**
 * 检测文本是否看起来像代码（用于选择 og_image 主题）
 */
function detectTextStyle(text: string): "default" | "code" | "elegant" {
  const codeIndicators = [
    /```/,
    /^\s*(function|const|let|var|import|export|class|interface|type|def|pub fn|async)/m,
    /\{[\s\S]*:[\s\S]*\}/,
    /\(\) =>/,
    /=> \{/,
  ];
  const codeScore = codeIndicators.filter((r) => r.test(text)).length;
  if (codeScore >= 2) return "code";
  if (text.includes("『") || text.includes("」") || text.length > 3000) return "elegant";
  return "default";
}

/**
 * 流式消息处理器
 * 用于 normal 模式：将超长文本分块发送
 */
export class StreamingMessageHandler {
  private buffer = "";
  private lastFlushTime = 0;
  private flushTimer?: ReturnType<typeof setTimeout>;
  private cfg: LongMessageConfig;
  private onChunks: (chunks: string[]) => void;

  constructor(
    config: Partial<LongMessageConfig>,
    onChunks: (chunks: string[]) => void,
  ) {
    this.cfg = { ...DEFAULT_LONGMSG_CONFIG, ...config };
    this.onChunks = onChunks;
  }

  /** 追加文本到缓冲区 */
  append(text: string, isFinal = false): void {
    this.buffer += text;

    if (isFinal) {
      // 最终块：立即 flush 剩余内容
      this.flush(true);
      return;
    }

    // 非最终块：按字符数阈值 flush
    if (this.buffer.length >= this.cfg.normalFlushChars) {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    const delay = this.cfg.normalFlushIntervalMs;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flush(false);
      // 如果 buffer 仍然超过阈值，继续调度
      if (this.buffer.length >= this.cfg.normalFlushChars) {
        this.scheduleFlush();
      }
    }, delay);
  }

  private flush(isFinal: boolean): void {
    if (!this.buffer) return;

    const now = Date.now();
    const timeSinceLastFlush = now - this.lastFlushTime;

    if (!isFinal && timeSinceLastFlush < this.cfg.normalFlushIntervalMs && this.buffer.length < this.cfg.normalFlushChars) {
      // 还没到 flush 时间，且没超过单次阈值，等下次
      return;
    }

    // 找到合适的断点（句号、换行、空格）
    let splitAt = this.cfg.normalFlushChars;
    if (this.buffer.length > this.cfg.normalFlushChars) {
      // 向前寻找最近的句子断点
      const candidates = [
        this.buffer.lastIndexOf("\n\n", splitAt),
        this.buffer.lastIndexOf("\n", splitAt),
        this.buffer.lastIndexOf("。", splitAt),
        this.buffer.lastIndexOf(". ", splitAt),
        this.buffer.lastIndexOf(" ", splitAt),
      ];
      const validCandidate = candidates.find((p) => p > splitAt * 0.6);
      if (validCandidate !== undefined && validCandidate > 0) {
        splitAt = validCandidate + 1;
      }
    }

    const toSend = this.buffer.slice(0, splitAt);
    this.buffer = this.buffer.slice(splitAt);
    this.lastFlushTime = Date.now();

    if (toSend.trim()) {
      this.onChunks([toSend.trim()]);
    }
  }

  /** 取消挂起的 flush */
  cancel(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /** 强制立即 flush */
  forceFlush(): string | null {
    this.cancel();
    if (!this.buffer.trim()) return null;
    const result = this.buffer;
    this.buffer = "";
    return result;
  }

  updateConfig(config: Partial<LongMessageConfig>): void {
    this.cfg = { ...this.cfg, ...config };
  }
}

/**
 * 判定使用哪种长消息模式
 * @param text 消息文本
 * @param cfg 配置
 * @param forceMode 强制模式（来自配置的优先级）
 */
export function determineLongMessageMode(
  text: string,
  cfg: LongMessageConfig,
  forceMode?: LongMessageMode,
): LongMessageMode {
  if (forceMode) return forceMode;

  // 未超过阈值，直接返回 normal（不需要特殊处理）
  if (text.length <= cfg.threshold) {
    return "normal";
  }

  // 根据内容特征自动推断模式
  const style = detectTextStyle(text);

  // 代码类内容优先用 og_image
  if (style === "code" || text.includes("```")) {
    return "og_image";
  }

  // 超长纯文本用 forward
  if (text.length > 8000 && !text.includes("```")) {
    return "forward";
  }

  return cfg.mode;
}

/**
 * 处理长消息的主要入口
 * @returns 消息段数组（如果需要 og_image/forward，返回包含特殊类型 segment 的数组）
 */
export interface LongMessageResult {
  /** 是否触发了长消息策略 */
  triggered: boolean;
  /** 处理模式 */
  mode: LongMessageMode;
  /** 消息段（可直接发送） */
  segments: OneBotSegment[];
  /** 渲染后的 HTML（og_image 模式） */
  ogHtml?: string;
  /** forward 节点（forward 模式） */
  forwardNodes?: ReturnType<typeof buildForwardNodes>;
  /** 流式处理器（normal 模式，保留引用以便后续追加） */
  streamingHandler?: StreamingMessageHandler;
  /** 需要延迟发送的块（normal 模式） */
  pendingChunks?: string[];
}

export function processLongMessage(
  text: string,
  config: Partial<LongMessageConfig>,
): LongMessageResult {
  const cfg = { ...DEFAULT_LONGMSG_CONFIG, ...config };
  const mode = determineLongMessageMode(text, cfg);

  // 未触发阈值，普通发送
  if (mode === "normal" && text.length <= cfg.threshold) {
    return {
      triggered: false,
      mode: "normal",
      segments: [{ type: "text", data: { text } }],
    };
  }

  if (mode === "og_image") {
    const html = buildOgHtml({
      content: text,
      theme: cfg.ogImageTheme,
      maxWidth: cfg.ogImageMaxWidth,
    });
    return {
      triggered: true,
      mode: "og_image",
      segments: [],
      ogHtml: html,
    };
  }

  if (mode === "forward") {
    const nodes = buildForwardNodes(text, cfg);
    return {
      triggered: true,
      mode: "forward",
      segments: [],
      forwardNodes: nodes,
    };
  }

  // normal 模式（超过阈值）
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > cfg.normalFlushChars) {
    let splitAt = cfg.normalFlushChars;
    const candidates = [
      remaining.lastIndexOf("\n\n", splitAt),
      remaining.lastIndexOf("\n", splitAt),
      remaining.lastIndexOf("。", splitAt),
      remaining.lastIndexOf(". ", splitAt),
      remaining.lastIndexOf(" ", splitAt),
    ];
    const validCandidate = candidates.find((p) => p > splitAt * 0.6);
    if (validCandidate !== undefined && validCandidate > 0) {
      splitAt = validCandidate + 1;
    }
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt);
  }
  if (remaining.trim()) {
    chunks.push(remaining.trim());
  }

  return {
    triggered: true,
    mode: "normal",
    segments: chunks.map((c) => ({ type: "text", data: { text: c } })),
    pendingChunks: chunks.slice(1), // 第一块随segments返回，剩余的需要后续发送
  };
}

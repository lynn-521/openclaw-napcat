/**
 * src/features/keyword-trigger.ts
 * 关键字触发引擎
 * 支持精确匹配、前缀/后缀匹配、正则表达式匹配
 */

export type TriggerType = "exact" | "prefix" | "suffix" | "contains" | "regex";

export interface KeywordTrigger {
  /** 触发器名称（唯一标识） */
  name: string;
  /** 触发类型 */
  type: TriggerType;
  /** 触发词/模式 */
  pattern: string;
  /** 编译后的正则（regex 类型专用） */
  regex?: RegExp;
  /** 触发后的处理方式 */
  action: "passthrough" | "block" | "command";
  /** 关联的命令（action=command 时） */
  command?: string;
  /** 是否区分大小写 */
  caseSensitive: boolean;
  /** 是否启用 */
  enabled: boolean;
}

/** 触发结果 */
export interface TriggerResult {
  matched: boolean;
  trigger?: KeywordTrigger;
  /** 触发后保留的文本（去除触发词） */
  remainingText?: string;
  /** 如果 action=block，返回拦截提示 */
  blockMessage?: string;
}

export interface KeywordTriggerConfig {
  /** 启用的关键字列表 */
  triggers: KeywordTrigger[];
  /** 默认处理方式（未匹配任何关键字时） */
  defaultAction: "passthrough" | "block";
  /** 黑名单词（任何匹配直接 block） */
  blocklist: string[];
  /** 黑名单词的正则 */
  blocklistRegex?: RegExp;
}

/** 默认配置 */
export const DEFAULT_KEYWORD_CONFIG: KeywordTriggerConfig = {
  triggers: [],
  defaultAction: "passthrough",
  blocklist: [],
};

/**
 * 编译关键字配置（解析 pattern，正则化）
 */
export function compileKeywordConfig(raw: KeywordTriggerConfig): KeywordTriggerConfig {
  const triggers = raw.triggers
    .filter((t) => t.enabled && t.pattern)
    .map((t) => {
      if (t.type === "regex") {
        try {
          return {
            ...t,
            regex: new RegExp(
              t.pattern,
              t.caseSensitive ? "" : "i",
            ),
          };
        } catch {
          // 无效正则，降级为 contains
          return { ...t, type: "contains" as TriggerType };
        }
      }
      return t;
    });

  let blocklistRegex: RegExp | undefined;
  if (raw.blocklist.length > 0) {
    const escaped = raw.blocklist.map((w) => escapeRegex(w)).join("|");
    blocklistRegex = new RegExp(escaped, "i");
  }

  return {
    ...raw,
    triggers,
    blocklistRegex,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 关键字触发器引擎
 */
export class KeywordTriggerEngine {
  private config: KeywordTriggerConfig;
  private compiled: KeywordTriggerConfig;

  constructor(rawConfig: KeywordTriggerConfig) {
    this.config = rawConfig;
    this.compiled = compileKeywordConfig(rawConfig);
  }

  /**
   * 更新配置（热重载）
   */
  updateConfig(raw: KeywordTriggerConfig): void {
    this.config = raw;
    this.compiled = compileKeywordConfig(raw);
  }

  /**
   * 检测文本是否命中黑名单
   */
  isBlocked(text: string): boolean {
    if (this.compiled.blocklistRegex) {
      if (this.compiled.blocklistRegex.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 检测文本是否匹配任何关键字
   * @param text 待检测文本
   * @returns 触发结果
   */
  match(text: string): TriggerResult {
    // 黑名单优先检查
    if (this.isBlocked(text)) {
      return {
        matched: true,
        trigger: undefined,
        blockMessage: "消息包含敏感词，已被拦截",
      };
    }

    for (const trigger of this.compiled.triggers) {
      if (!trigger.enabled) continue;

      const matched = this.doesMatch(text, trigger);
      if (matched) {
        const remainingText = this.getRemainingText(text, trigger);

        if (trigger.action === "block") {
          return {
            matched: true,
            trigger,
            blockMessage: `消息命中关键字 [${trigger.name}]，已被拦截`,
          };
        }

        return {
          matched: true,
          trigger,
          remainingText: trigger.action === "command" ? trigger.command : remainingText,
        };
      }
    }

    // 无匹配
    if (this.config.defaultAction === "block") {
      return {
        matched: false,
        blockMessage: "未匹配任何已注册的关键字，此频道当前仅响应特定命令",
      };
    }

    return { matched: false };
  }

  /** 检测是否匹配 */
  private doesMatch(text: string, trigger: KeywordTrigger): boolean {
    const searchText = trigger.caseSensitive ? text : text.toLowerCase();
    const pattern = trigger.caseSensitive ? trigger.pattern : trigger.pattern.toLowerCase();

    switch (trigger.type) {
      case "exact":
        return searchText === pattern;
      case "prefix":
        return searchText.startsWith(pattern);
      case "suffix":
        return searchText.endsWith(pattern);
      case "contains":
        return searchText.includes(pattern);
      case "regex":
        return trigger.regex ? trigger.regex.test(text) : false;
      default:
        return false;
    }
  }

  /** 去除触发词后返回剩余文本 */
  private getRemainingText(text: string, trigger: KeywordTrigger): string {
    const searchText = trigger.caseSensitive ? text : text.toLowerCase();
    const pattern = trigger.caseSensitive ? trigger.pattern : trigger.pattern.toLowerCase();

    switch (trigger.type) {
      case "exact":
        return text.slice(trigger.pattern.length).trim();
      case "prefix":
        return text.slice(pattern.length).trim();
      case "suffix":
        return text.slice(0, text.length - pattern.length).trim();
      case "contains": {
        const idx = searchText.indexOf(pattern);
        const before = text.slice(0, idx).trim();
        const after = text.slice(idx + pattern.length).trim();
        return (before + " " + after).trim();
      }
      case "regex":
        if (!trigger.regex) return text;
        return text.replace(trigger.regex, "").trim();
      default:
        return text;
    }
  }

  /** 获取所有已配置的关键字摘要（用于调试） */
  getTriggerSummary(): Array<{ name: string; type: TriggerType; pattern: string; action: string }> {
    return this.config.triggers
      .filter((t) => t.enabled)
      .map((t) => ({
        name: t.name,
        type: t.type,
        pattern: t.pattern,
        action: t.action,
      }));
  }

  /** 检查某个触发器是否已注册 */
  hasTrigger(name: string): boolean {
    return this.config.triggers.some((t) => t.name === name);
  }

  /** 动态添加触发器（运行时） */
  addTrigger(trigger: KeywordTrigger): void {
    this.config.triggers.push(trigger);
    this.compiled = compileKeywordConfig(this.config);
  }

  /** 动态移除触发器（运行时） */
  removeTrigger(name: string): boolean {
    const before = this.config.triggers.length;
    this.config.triggers = this.config.triggers.filter((t) => t.name !== name);
    if (this.config.triggers.length !== before) {
      this.compiled = compileKeywordConfig(this.config);
      return true;
    }
    return false;
  }
}

/**
 * 从配置对象构造触发器数组（配置文件中使用）
 * 支持简写格式：
 * - "hello" → exact match
 * - "prefix:*" → prefix match
 * - "*:suffix" → suffix match
 * - "/regex/flags" → regex match
 */
export function parseTriggerFromConfig(
  name: string,
  raw: string | KeywordTrigger,
): KeywordTrigger {
  if (typeof raw === "object") {
    return { ...raw, name };
  }

  // 正则表达式格式：/pattern/flags
  if (raw.startsWith("/")) {
    const match = raw.match(/^\/(.+)\/([gimsuy]*)$/);
    if (match) {
      return {
        name,
        type: "regex",
        pattern: match[1],
        action: "passthrough",
        caseSensitive: false,
        enabled: true,
      };
    }
  }

  // 前缀匹配：prefix:keyword
  if (raw.startsWith("prefix:")) {
    return {
      name,
      type: "prefix",
      pattern: raw.slice(7),
      action: "passthrough",
      caseSensitive: false,
      enabled: true,
    };
  }

  // 后缀匹配：suffix:keyword
  if (raw.startsWith("suffix:")) {
    return {
      name,
      type: "suffix",
      pattern: raw.slice(7),
      action: "passthrough",
      caseSensitive: false,
      enabled: true,
    },
  }

  // 默认：精确匹配
  return {
    name,
    type: "exact",
    pattern: raw,
    action: "passthrough",
    caseSensitive: false,
    enabled: true,
  };
}

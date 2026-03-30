import type { NapCatAccountConfig } from "../types.js";

export type KeywordMatchResult = {
  matched: boolean;
  keyword?: string;
  matchType: "exact" | "contains" | "regex" | "any";
};

/**
 * Check if a message matches any keyword in the given mode.
 */
export function matchKeywords(
  text: string,
  keywords: string[],
  mode: "contains" | "exact" | "regex" | "any",
): KeywordMatchResult {
  if (!text || keywords.length === 0) {
    return { matched: false, matchType: mode };
  }

  const lowerText = text.toLowerCase();

  for (const keyword of keywords) {
    if (!keyword) continue;

    switch (mode) {
      case "exact": {
        if (text === keyword) {
          return { matched: true, keyword, matchType: "exact" };
        }
        break;
      }
      case "contains": {
        if (lowerText.includes(keyword.toLowerCase())) {
          return { matched: true, keyword, matchType: "contains" };
        }
        break;
      }
      case "regex": {
        try {
          const re = new RegExp(keyword, "i");
          if (re.test(text)) {
            return { matched: true, keyword, matchType: "regex" };
          }
        } catch {
          // Invalid regex, skip this keyword
          continue;
        }
        break;
      }
      case "any": {
        // "any" mode: message must contain all keywords (AND logic)
        const allMatch = keywords.every(
          (kw) => kw && lowerText.includes(kw.toLowerCase()),
        );
        if (allMatch) {
          return { matched: true, keyword: keywords.join("+"), matchType: "any" };
        }
        return { matched: false, matchType: "any" };
      }
    }
  }

  return { matched: false, matchType: mode };
}

export type TriggerResult = {
  triggered: boolean;
  response?: string;
  action?: string;
};

/**
 * Check if a message triggers a keyword response.
 */
export function checkTrigger(
  message: string,
  config: NapCatAccountConfig,
): TriggerResult {
  const kt = config.keywordTriggers;
  if (!kt || !kt.enabled) {
    return { triggered: false };
  }

  const keywords = kt.keywords ?? [];
  if (keywords.length === 0) {
    return { triggered: false };
  }

  const match = matchKeywords(message, keywords, kt.mode ?? "contains");
  if (!match.matched) {
    return { triggered: false };
  }

  return {
    triggered: true,
    response: kt.response,
    action: kt.action,
  };
}

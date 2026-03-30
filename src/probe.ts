/**
 * NapCat HTTP API probe — checks if the OneBot 11 HTTP API is reachable
 * and returns basic bot info.
 */

import { callOneBotApi } from "./api.js";

export interface NapCatProbeResult {
  ok: boolean;
  bot?: {
    user_id?: number;
    nickname?: string;
  };
  error?: string;
}

/**
 * Probe the NapCat HTTP API (get_login_info).
 */
export async function probeNapCat(
  httpApi: string,
  accessToken: string | undefined,
  timeoutMs = 5000,
): Promise<NapCatProbeResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const resp = await callOneBotApi<{ user_id: number; nickname: string }>(
      "get_login_info",
      httpApi,
      {},
      { accessToken },
    ).finally(() => clearTimeout(timeout));

    const data = resp.data;
    return {
      ok: true,
      bot: {
        user_id: data.user_id,
        nickname: data.nickname,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

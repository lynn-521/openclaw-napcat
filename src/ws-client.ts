/**
 * NapCat WebSocket full-duplex client.
 *
 * NapCat's Forward WS and Reverse WS both support bidirectional communication:
 * - Inbound events (napcat → OpenClaw) are handled in monitor.ts
 * - Outbound API calls (OpenClaw → napcat → OpenClaw) are handled here
 *
 * This module provides WS-based API calls with echo-matching for responses,
 * and falls back to HTTP when WS is unavailable.
 */

import type { WebSocket } from "ws";
import type { NapCatSegment } from "./api.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A pending outbound WS API call awaiting a response. */
type PendingApiCall = {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
};

export interface WsApiResponse<T = unknown> {
  status: "ok" | "failed";
  retcode: number;
  data: T;
  echo?: string;
}

// ---------------------------------------------------------------------------
// Module-level global state (shared across all napcat accounts)
// ---------------------------------------------------------------------------

let _activeWs: WebSocket | null = null;
let _accessToken: string = "";
const _pendingApiCalls = new Map<string, PendingApiCall>();

// ---------------------------------------------------------------------------
// WS lifecycle (called from monitor.ts)
// ---------------------------------------------------------------------------

/**
 * Register the active NapCat WebSocket connection.
 * Called when the WS opens in monitor.ts.
 */
export function setNapCatWs(ws: WebSocket, accessToken: string): void {
  _activeWs = ws;
  _accessToken = accessToken ?? "";
}

/**
 * Clear the active WS on disconnect.
 * Cancels all pending API calls and resets state.
 */
export function clearNapCatWs(): void {
  if (_activeWs) {
    // Reject all pending calls
    for (const [echo, pending] of _pendingApiCalls) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("WS disconnected"));
    }
    _pendingApiCalls.clear();
  }
  _activeWs = null;
  _accessToken = "";
}

/** Returns true if the WS is connected and ready. */
export function isNapCatWsConnected(): boolean {
  return _activeWs !== null && _activeWs.readyState === 1 /* OPEN */;
}

/** Returns the current WS instance (for external checks). */
export function getNapCatWs(): WebSocket | null {
  return _activeWs;
}

// ---------------------------------------------------------------------------
// Core WS API caller with echo matching
// ---------------------------------------------------------------------------

/**
 * Send a OneBot API call over WebSocket and wait for the response.
 *
 * Uses the `echo` field to correlate request/response, matching the
 * OneBot 11 WebSocket API protocol.
 *
 * @param action   OneBot API action name (e.g. "send_group_msg")
 * @param params   API parameters
 * @param timeoutMs Response timeout in ms (default 10s)
 */
export async function wsCallApi<T = unknown>(
  action: string,
  params: Record<string, unknown>,
  timeoutMs = 10000,
): Promise<T> {
  if (!_activeWs || _activeWs.readyState !== 1 /* OPEN */) {
    throw new Error("WS not connected");
  }

  const echo = crypto.randomUUID();

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      _pendingApiCalls.delete(echo);
      reject(new Error(`WS API call ${action} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    _pendingApiCalls.set(echo, { resolve, reject, timeout: timer });

    const payload = {
      action,
      params: {
        ...params,
        ...(_accessToken ? { access_token: _accessToken } : {}),
      },
      echo,
    };

    _activeWs!.send(JSON.stringify(payload));
  });
}

/**
 * Process an incoming WS message.
 *
 * Called from monitor.ts's ws.on("message") handler.
 * - If the message has a matching `echo`, resolve/reject the pending call.
 * - Otherwise return null (caller handles it as an inbound event).
 *
 * Returns the parsed response object if this was an API response, or null.
 */
export function processWsApiResponse(
  raw: Buffer,
): WsApiResponse<unknown> | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.toString()) as Record<string, unknown>;
  } catch {
    return null;
  }

  // Only handle messages with an echo that we are waiting for
  const echo = data.echo as string | undefined;
  if (!echo || !_pendingApiCalls.has(echo)) {
    return null;
  }

  const pending = _pendingApiCalls.get(echo)!;
  clearTimeout(pending.timeout);
  _pendingApiCalls.delete(echo);

  const resp = data as unknown as WsApiResponse<unknown>;

  if (resp.status === "ok") {
    pending.resolve(resp.data);
  } else {
    pending.reject(new Error(`WS API failed: retcode=${resp.retcode}`));
  }

  return resp;
}

// ---------------------------------------------------------------------------
// High-level OneBot API wrappers (WS-first)
// ---------------------------------------------------------------------------

interface SendResult {
  message_id: number;
}

/**
 * Send a private message via WebSocket.
 */
export async function wsSendPrivateMsg(
  userId: number,
  segments: NapCatSegment[],
): Promise<SendResult> {
  return wsCallApi<SendResult>("send_private_msg", {
    user_id: userId,
    message: segments,
  });
}

/**
 * Send a group message via WebSocket.
 */
export async function wsSendGroupMsg(
  groupId: number,
  segments: NapCatSegment[],
): Promise<SendResult> {
  return wsCallApi<SendResult>("send_group_msg", {
    group_id: groupId,
    message: segments,
  });
}

/**
 * Upload a file to a group via WebSocket (NapCat extension).
 */
export async function wsUploadGroupFile(
  groupId: number,
  file: string,
  name: string,
): Promise<{ file_id: string; file_name: string }> {
  return wsCallApi("upload_group_file", { group_id: groupId, file, name });
}

/**
 * Upload a file to a private chat via WebSocket (NapCat extension).
 */
export async function wsUploadPrivateFile(
  userId: number,
  file: string,
  name: string,
): Promise<{ file_id: string; file_name: string }> {
  return wsCallApi("upload_private_file", { user_id: userId, file, name });
}

/**
 * Get message content via WebSocket (get_msg API).
 */
export async function wsGetMsg(
  messageId: number,
): Promise<Record<string, unknown>> {
  return wsCallApi("get_msg", { message_id: messageId });
}

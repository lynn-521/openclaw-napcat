/**
 * NapCat OneBot 11 HTTP API client.
 *
 * These functions are used for OUTBOUND operations (sending messages, uploading files).
 * Inbound messages arrive via Forward WS in `monitor.ts`.
 *
 * The `httpApi` parameter should be the base URL of napcat's OneBot 11 HTTP API
 * (e.g. http://127.0.0.1:3000). If napcat does not have HTTP API enabled, these
 * functions will fail.
 */

// Re-export OneBotSegment type for consumers that need it
export type { OneBotSegment } from "./types.js";

/** OneBot 11 message segment — data field uses string Record for compatibility. */
export type NapCatSegment = {
  type: string;
  data: Record<string, string | undefined>;
};

export function textSegment(text: string): NapCatSegment {
  return { type: "text", data: { text } };
}

export function replySegment(messageId: number | string): NapCatSegment {
  return { type: "reply", data: { id: String(messageId) } };
}

export function recordSegment(url: string): NapCatSegment {
  return { type: "record", data: { file: url, url } };
}

export function videoSegment(url: string): NapCatSegment {
  return { type: "video", data: { file: url, url } };
}

export function imageSegment(fileOrUrl: string): NapCatSegment {
  return { type: "image", data: { file: fileOrUrl } };
}

// ---------------------------------------------------------------------------
// Core HTTP call
// ---------------------------------------------------------------------------

export interface OneBotApiResponse<T = unknown> {
  status: "ok" | "failed";
  retcode: number;
  data: T;
  echo?: string;
}

async function buildHeaders(accessToken?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  return headers;
}

/**
 * Generic OneBot 11 API caller.
 * Returns the full OneBotApiResponse (caller accesses .data for the actual payload).
 */
export async function callOneBotApi<T = unknown>(
  action: string,
  httpApi: string,
  params?: Record<string, unknown>,
  options?: { accessToken?: string },
): Promise<OneBotApiResponse<T>> {
  const url = `${httpApi.replace(/\/$/, "")}/${action}`;
  const response = await fetch(url, {
    method: "POST",
    headers: await buildHeaders(options?.accessToken),
    body: JSON.stringify({
      action,
      params: params ?? {},
    }),
  });

  if (!response.ok) {
    throw new Error(`OneBot API HTTP ${response.status}: ${response.statusText}`);
  }

  const json = (await response.json()) as OneBotApiResponse<T>;
  if (json.status === "failed") {
    throw new Error(`OneBot API ${action} failed: retcode=${json.retcode}`);
  }

  return json;
}

// ---------------------------------------------------------------------------
// get_msg — fetch a message by ID
// ---------------------------------------------------------------------------

export interface GetMsgResult {
  group_id?: number;
  message_id?: number;
  real_id?: number;
  message_type?: string;
  sender?: {
    user_id?: number;
    nickname?: string;
    card?: string;
    sex?: string;
    age?: number;
    role?: string;
  };
  message: NapCatSegment[];
  message_format?: string;
  time?: number;
}

/**
 * Get message content via OneBot 11 HTTP API (get_msg).
 */
export async function getMsg(
  httpApi: string,
  messageId: number,
  accessToken?: string,
): Promise<GetMsgResult> {
  const resp = await callOneBotApi<GetMsgResult>(
    "get_msg",
    httpApi,
    { message_id: messageId },
    { accessToken },
  );
  return resp.data as GetMsgResult;
}

// ---------------------------------------------------------------------------
// send_msg helpers
// ---------------------------------------------------------------------------

interface SendResult {
  message_id: number;
}

/**
 * Send a private message via OneBot 11 HTTP API.
 */
export async function sendPrivateMsg(
  httpApi: string,
  userId: number,
  segments: NapCatSegment[],
  accessToken?: string,
): Promise<SendResult> {
  const resp = await callOneBotApi<SendResult>(
    "send_private_msg",
    httpApi,
    {
      user_id: userId,
      message: segments,
    },
    { accessToken },
  );
  return resp.data as SendResult;
}

/**
 * Send a group message via OneBot 11 HTTP API.
 */
export async function sendGroupMsg(
  httpApi: string,
  groupId: number,
  segments: NapCatSegment[],
  accessToken?: string,
): Promise<SendResult> {
  const resp = await callOneBotApi<SendResult>(
    "send_group_msg",
    httpApi,
    {
      group_id: groupId,
      message: segments,
    },
    { accessToken },
  );
  return resp.data as SendResult;
}

// ---------------------------------------------------------------------------
// upload_file — upload a file and return the file ID for sending
// ---------------------------------------------------------------------------

interface UploadFileResult {
  file_id: string;
  file_name: string;
}

/**
 * Upload a file to a group (NapCat extension).
 */
export async function uploadGroupFile(
  httpApi: string,
  groupId: number,
  fileUrl: string,
  name: string,
  accessToken?: string,
): Promise<UploadFileResult> {
  const resp = await callOneBotApi<UploadFileResult>(
    "upload_group_file",
    httpApi,
    {
      group_id: groupId,
      file: fileUrl,
      name,
    },
    { accessToken },
  );
  return resp.data as UploadFileResult;
}

/**
 * Upload a file to a private chat (NapCat extension).
 */
export async function uploadPrivateFile(
  httpApi: string,
  userId: number,
  fileUrl: string,
  name: string,
  accessToken?: string,
): Promise<UploadFileResult> {
  const resp = await callOneBotApi<UploadFileResult>(
    "upload_private_file",
    httpApi,
    {
      user_id: userId,
      file: fileUrl,
      name,
    },
    { accessToken },
  );
  return resp.data as UploadFileResult;
}

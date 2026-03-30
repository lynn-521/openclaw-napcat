// Direct JSON Schema — bypasses zod to avoid version/instance mismatch at runtime.

export const NapCatChannelConfigSchema = {
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      enabled: { type: "boolean" },
      httpApi: {
      type: "string",
      description:
        "NapCat OneBot 11 HTTP API 地址（可选，WS 不可用时降级使用）",
    },
      accessToken: { type: "string" },
      selfId: { type: "string" },
      dmPolicy: { type: "string", enum: ["open", "pairing", "allowlist", "disabled"] },
      allowFrom: {
        type: "array",
        items: { type: ["string", "number"] },
      },
      groupPolicy: { type: "string", enum: ["open", "allowlist", "disabled"] },
      groupAllowFrom: {
        type: "array",
        items: { type: ["string", "number"] },
      },
      mediaMaxMb: { type: "number" },
      responsePrefix: { type: "string" },
      wsUrl: { type: "string" },
      accounts: {
        type: "object",
        additionalProperties: true,
      },
      defaultAccount: { type: "string" },
      rateLimit: {
        type: "object",
        description: "速率限制配置",
        properties: {
          enabled: { type: "boolean", default: true },
          maxPerMinute: { type: "number", default: 20 },
          maxPerHour: { type: "number", default: 500 },
          maxPerDay: { type: "number", default: 3000 },
        },
        additionalProperties: false,
      },
      admins: {
        type: "array",
        items: { type: "string" },
        default: [],
        description: "管理员 QQ 号列表（可执行所有操作）",
      },
    },
    additionalProperties: true,
  },
  uiHints: {
    httpApi: {
      label: "NapCat HTTP API（降级用）",
      help: "NapCat OneBot 11 HTTP API 地址（可选，优先使用 WS 全双工通信，WS 不可用时降级）",
      placeholder: "http://127.0.0.1:3000",
    },
    accessToken: {
      label: "Access Token",
      sensitive: true,
      help: "OneBot 11 API 鉴权 token (可选)",
    },
    selfId: {
      label: "机器人 QQ 号",
      help: "机器人的 QQ 号码，用于检测 @机器人",
    },
    dmPolicy: {
      label: "私聊策略",
      help: "allowlist=白名单, pairing=配对, open=开放, disabled=禁用",
    },
    allowFrom: {
      label: "私聊白名单",
      help: "允许私聊的 QQ 号列表",
    },
    groupPolicy: {
      label: "群聊策略",
      help: "allowlist=白名单, open=开放, disabled=禁用",
    },
    groupAllowFrom: {
      label: "群聊白名单",
      help: "允许在群聊中触发的 QQ 号列表",
    },
    mediaMaxMb: {
      label: "最大媒体大小 (MB)",
      advanced: true,
    },
    responsePrefix: {
      label: "回复前缀",
      advanced: true,
    },
    wsUrl: {
      label: "NapCat WebSocket URL（推荐）",
      help: "NapCat OneBot 11 WS 服务器地址，用于全双工通信（例: ws://127.0.0.1:3002）",
      placeholder: "ws://127.0.0.1:3002",
    },
    rateLimit: {
      label: "速率限制",
      help: "启用后可限制用户每分钟/小时/天的消息触发次数，防止滥用",
      advanced: true,
    },
    admins: {
      label: "管理员列表",
      help: "管理员 QQ 号列表，可执行所有操作（包括高危操作）",
    },
  },
} as const;

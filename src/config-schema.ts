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
      groupEvents: {
        type: "object",
        description: "入退群事件钩子配置",
        properties: {
          onJoin: {
            type: "object",
            properties: {
              enabled: { type: "boolean", default: false },
              welcomeMessage: { type: "string" },
              atNewMember: { type: "boolean", default: true },
              adminOnly: { type: "boolean", default: false },
            },
            additionalProperties: false,
          },
          onLeave: {
            type: "object",
            properties: {
              enabled: { type: "boolean", default: false },
              farewellMessage: { type: "string" },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      whitelist: {
        type: "object",
        description: "白名单/黑名单访问控制",
        properties: {
          enabled: { type: "boolean", default: false },
          mode: { type: "string", enum: ["allowlist", "blocklist"], default: "blocklist" },
          allowUsers: {
            type: "array",
            items: { type: "string" },
            default: [],
            description: "允许的私聊用户 QQ 号",
          },
          allowGroups: {
            type: "array",
            items: { type: "string" },
            default: [],
            description: "允许的群 ID",
          },
          blockUsers: {
            type: "array",
            items: { type: "string" },
            default: [],
            description: "禁止的私聊用户 QQ 号",
          },
          blockGroups: {
            type: "array",
            items: { type: "string" },
            default: [],
            description: "禁止的群 ID",
          },
        },
        additionalProperties: false,
      },
      longMessage: {
        type: "object",
        description: "长消息处理配置",
        properties: {
          threshold: {
            type: "number",
            default: 300,
            description: "触发长消息处理的字符数阈值",
          },
          mode: {
            type: "string",
            enum: ["normal", "og_image", "forward"],
            default: "normal",
            description: "长消息处理模式：normal=分片发送，og_image=渲染图片，forward=合并转发",
          },
          normal: {
            type: "object",
            description: "normal 模式配置",
            properties: {
              flushIntervalMs: {
                type: "number",
                default: 1200,
                description: "每段消息之间的发送间隔（毫秒）",
              },
              flushChars: {
                type: "number",
                default: 160,
                description: "每段消息的字符数",
              },
            },
            additionalProperties: false,
          },
          ogImage: {
            type: "object",
            description: "og_image 模式配置",
            properties: {
              renderTheme: {
                type: "string",
                default: "default",
                description: "渲染主题（default/dark）",
              },
              fontSize: {
                type: "number",
                default: 14,
                description: "渲染字体大小（px）",
              },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      keywordTriggers: {
        type: "object",
        description: "关键字触发引擎",
        properties: {
          enabled: { type: "boolean", default: false },
          mode: {
            type: "string",
            enum: ["contains", "exact", "regex", "any"],
            default: "contains",
            description: "触发模式：contains=包含匹配，exact=精确匹配，regex=正则匹配，any=所有关键词都包含",
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            default: [],
            description: "触发关键词列表",
          },
          requireAt: {
            type: "boolean",
            default: false,
            description: "是否需要 @机器人 才触发",
          },
          response: {
            type: "string",
            description: "命中关键词后的固定回复（不填则走 AI 处理）",
          },
          action: {
            type: "string",
            description: "命中后执行的脚本路径（可选）",
          },
        },
        additionalProperties: false,
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
    whitelist: {
      label: "白名单/黑名单",
      help: "启用后可精细控制哪些用户和群可以与机器人交互。allowlist=仅允许名单，blocklist=允许所有但排除黑名单",
      advanced: true,
    },
    longMessage: {
      label: "长消息处理",
      help: "AI 回复超过阈值字符时自动启用：normal=分片发送，og_image=渲染图片，forward=合并转发",
    },
    keywordTriggers: {
      label: "关键字触发",
      help: "配置关键字匹配规则，命中后发送固定回复或执行脚本",
      advanced: true,
    },
  },
} as const;

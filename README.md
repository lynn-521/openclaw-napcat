# openclaw-napcat

[English](./README_EN.md) | 中文

[![npm](https://img.shields.io/npm/v/@lynn-521/napcat)](https://www.npmjs.com/package/@lynn-521/napcat)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

> **⚠️ 免责声明**：本插件由个人开发并开源，用于学习与研究目的。使用本插件产生的任何行为（如发送消息、群管理操作等）由使用者自行承担全部责任。开发者不对因使用本插件而造成的任何直接或间接损失负责。

---

## 🔰 Fork 来源与版本说明

本插件基于 OpenClaw QQ 频道插件项目 fork 而来，由 **minimax-m2.7** 完成以下增强开发：

### 核心升级
- **OpenClaw 3.28 兼容性适配** —— 适配最新 SDK v2026.3.28
- **WebSocket 全双工通信** —— 消息收发均走 WS，性能更高，HTTP API 仅作降级

### 新增功能
| 功能 | 说明 |
|------|------|
| 速率限制 | 三级限流：分钟/小时/天，防止恶意刷消息 |
| 管理员守卫 | 14个高危操作需要管理员授权 |
| 白名单/黑名单 | 精细化访问控制，支持 allowlist/blocklist 两种模式 |
| 关键字触发 | contains/exact/regex/any 四种匹配模式 |
| 长消息处理 | normal分片/og_image图片/forward转发 三种模式 |
| 入退群钩子 | 欢迎消息/告别消息，支持占位符模板 |
| 群荣誉查询 | 龙王、群聊之火等荣誉信息 |

让 AI 助手通过自然语言完全控制 QQ 交互 —— 点赞、戳一戳、禁言、踢人、查看用户资料、管理群组等。

---

## 📦 安装方式

### 方式一：npm 安装（推荐）✅

```bash
openclaw plugins install @lynn-521/napcat
```

### 方式二：ClawHub 安装

```bash
openclaw plugins install "clawhub:@lynn-521/napcat"
```

### 方式三：GitHub 克隆

```bash
cd ~/.openclaw/extensions
git clone https://github.com/lynn-521/openclaw-napcat.git napcat
cd napcat && npm install --omit=dev
```

---

## ⚙️ 前置要求

- 已安装并运行 [OpenClaw](https://github.com/openclaw/openclaw)
- 已运行 [NapCat](https://github.com/NapNeko/NapCatQQ) 并开启 WebSocket 服务
- Node.js 22+

---

## 🚀 快速配置

在 OpenClaw 配置中添加（`openclaw config edit`）：

```json
{
  "channels": {
    "napcat": {
      "wsUrl": "ws://127.0.0.1:3002",
      "accessToken": "你的token",
      "selfId": "123456789"
    }
  }
}
```

### 完整配置示例

```json
{
  "channels": {
    "napcat": {
      "wsUrl": "ws://127.0.0.1:3002",
      "httpApi": "http://127.0.0.1:3000",
      "accessToken": "你的token",
      "selfId": "123456789",

      "dmPolicy": "allowlist",
      "allowFrom": ["好友QQ号"],

      "groupPolicy": "allowlist",
      "groupAllowFrom": ["群号"],

      "rateLimit": {
        "enabled": true,
        "maxPerMinute": 20,
        "maxPerHour": 500,
        "maxPerDay": 3000
      },

      "admins": ["管理员QQ号"],

      "groupEvents": {
        "onJoin": {
          "enabled": true,
          "welcomeMessage": "欢迎 {nickname} 加入本群！",
          "atNewMember": true
        },
        "onLeave": {
          "enabled": false,
          "farewellMessage": "{user_id} 离开了群聊"
        }
      },

      "keywordTriggers": {
        "enabled": true,
        "mode": "contains",
        "keywords": ["帮助", "help"],
        "requireAt": false,
        "response": "你好！有什么可以帮你的吗？"
      },

      "whitelist": {
        "enabled": false,
        "mode": "blocklist",
        "allowUsers": [],
        "allowGroups": [],
        "blockUsers": [],
        "blockGroups": []
      },

      "longMessage": {
        "threshold": 300,
        "mode": "normal",
        "normal": {
          "flushIntervalMs": 1200,
          "flushChars": 160
        },
        "ogImage": {
          "renderTheme": "default",
          "fontSize": 14
        }
      }
    }
  }
}
```

---

## 📋 配置字段说明

### 基础配置

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `wsUrl` | NapCat WebSocket 地址（Forward WS 模式） | 必填 |
| `httpApi` | NapCat HTTP API 地址（WS 降级用） | 可选 |
| `accessToken` | API 鉴权 token | 可选 |
| `selfId` | 机器人自身 QQ 号（用于 @机器人检测） | 必填 |

### 通信策略

| 字段 | 说明 |
|------|------|
| `dmPolicy` | 私聊策略：`allowlist` / `pairing` / `open` / `disabled` |
| `allowFrom` | 允许私聊的 QQ 号列表 |
| `groupPolicy` | 群聊策略：`allowlist` / `open` / `disabled` |
| `groupAllowFrom` | 允许在群聊中触发的 QQ 号列表 |

### 速率限制

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `rateLimit.enabled` | 是否启用速率限制 | `true` |
| `rateLimit.maxPerMinute` | 每分钟最大消息数 | `20` |
| `rateLimit.maxPerHour` | 每小时最大消息数 | `500` |
| `rateLimit.maxPerDay` | 每天最大消息数 | `3000` |

### 安全配置

| 字段 | 说明 |
|------|------|
| `admins` | 管理员 QQ 号列表，可执行所有操作（包括 14 个高危操作） |

### 入退群事件钩子

| 字段 | 说明 |
|------|------|
| `groupEvents.onJoin.enabled` | 是否启用入群欢迎消息 |
| `groupEvents.onJoin.welcomeMessage` | 欢迎消息模板，支持 `{nickname}`、`{user_id}` 占位符 |
| `groupEvents.onJoin.atNewMember` | 是否 @新成员 |
| `groupEvents.onJoin.adminOnly` | 是否仅管理员可触发 |
| `groupEvents.onLeave.enabled` | 是否启用退群告别消息 |
| `groupEvents.onLeave.farewellMessage` | 告别消息模板，支持 `{user_id}` 占位符 |

### 关键字触发引擎

| 字段 | 说明 |
|------|------|
| `keywordTriggers.enabled` | 是否启用关键字触发 |
| `keywordTriggers.mode` | 匹配模式：`contains`（包含）/ `exact`（精确）/ `regex`（正则）/ `any`（AND） |
| `keywordTriggers.keywords` | 触发关键词列表 |
| `keywordTriggers.requireAt` | 是否需要 @机器人 才触发 |
| `keywordTriggers.response` | 命中后的固定回复（不填则走 AI 处理） |
| `keywordTriggers.action` | 命中后执行的脚本路径 |

### 白名单/黑名单

| 字段 | 说明 |
|------|------|
| `whitelist.enabled` | 是否启用访问控制 |
| `whitelist.mode` | `allowlist`=仅允许名单，`blocklist`=排除黑名单 |
| `whitelist.allowUsers` | allowlist 模式下允许的私聊用户 |
| `whitelist.allowGroups` | allowlist 模式下允许的群 |
| `whitelist.blockUsers` | blocklist 模式下禁止的私聊用户 |
| `whitelist.blockGroups` | blocklist 模式下禁止的群 |

### 长消息处理

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `longMessage.threshold` | 触发长消息处理的字符数阈值 | `300` |
| `longMessage.mode` | 处理模式：`normal` / `og_image` / `forward` | `normal` |
| `longMessage.normal.flushIntervalMs` | normal 模式每段发送间隔（毫秒） | `1200` |
| `longMessage.normal.flushChars` | normal 模式每段字符数 | `160` |
| `longMessage.ogImage.renderTheme` | og_image 渲染主题：`default` / `dark` | `default` |
| `longMessage.ogImage.fontSize` | og_image 字体大小（px） | `14` |

### 长消息三种模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `normal` | 文本分片，每片带 reply 段，[1/N] 序号 | 大多数场景，避免刷屏 |
| `og_image` | 渲染为 PNG 图片发送，保留格式 | 代码、表格等长内容 |
| `forward` | QQ 合并转发消息，分多个节点 | 超长文本 |

---

## 🛡️ 管理员权限守卫（14 个高危操作）

以下操作需要管理员授权，非管理员无法执行：

| 工具 | 功能 |
|------|------|
| `qq_recall_message` | 撤回消息 |
| `qq_download_file` | 下载文件 |
| `qq_set_essence_msg` | 设置精华消息 |
| `qq_delete_essence_msg` | 移除精华消息 |
| `qq_set_friend_remark` | 设置好友备注 |
| `qq_delete_friend` | 删除好友 |
| `qq_mute_group_member` | 禁言群成员 |
| `qq_kick_group_member` | 踢出群成员 |
| `qq_set_group_card` | 设置群名片 |
| `qq_set_group_admin` | 设置/取消群管理员 |
| `qq_set_group_name` | 修改群名称 |
| `qq_set_group_whole_ban` | 全员禁言开关 |
| `qq_set_group_special_title` | 设置群成员专属头衔 |
| `qq_set_group_leave` | 退出群聊 |
| `qq_set_group_portrait` | 设置群头像 |
| `qq_set_group_remark` | 设置群备注 |
| `qq_send_group_notice` | 发送群公告 |
| `qq_delete_group_notice` | 删除群公告 |
| `qq_create_group_file_folder` | 创建群文件夹 |
| `qq_delete_group_file` | 删除群文件 |
| `qq_handle_friend_request` | 处理好友请求 |
| `qq_handle_group_request` | 处理加群请求 |

---

## 🔧 功能特性

- **WebSocket 全双工通信** —— 消息收发均走 WS，性能更高，HTTP API 仅作降级
- **45 个 AI Agent 工具** —— AI 通过自然语言指令执行 QQ 操作
- **@提及识别** —— 自动识别消息中的 `@QQ号` 并映射到用户 ID
- **语音转文字 (STT)** —— 自动将语音消息转录为文字后发送给 AI
- **多账号支持** —— 支持配置多个 NapCat 机器人账号
- **速率限制** —— 三级限流：分钟/小时/天，防止恶意刷消息
- **管理员权限守卫** —— 高危操作需要管理员授权
- **入退群事件钩子** —— 欢迎消息/告别消息
- **关键字触发引擎** —— 四种匹配模式
- **白名单/黑名单** —— 精细化访问控制
- **长消息智能处理** —— 三种模式自动选择

---

## 🛠️ Agent 工具列表

### 查询工具

| 工具 | 功能 |
|------|------|
| `qq_like_user` | 给用户点赞 |
| `qq_get_user_info` | 获取用户资料 |
| `qq_get_group_info` | 获取群信息 |
| `qq_get_group_member_info` | 获取群成员详细信息 |
| `qq_get_friend_list` | 获取好友列表 |
| `qq_get_group_list` | 获取群列表 |
| `qq_get_group_member_list` | 获取群成员列表 |
| `qq_get_group_honor_info` | 获取群荣誉（龙王等） |

### 消息历史

| 工具 | 功能 |
|------|------|
| `qq_get_group_msg_history` | 获取群聊历史消息 |
| `qq_get_friend_msg_history` | 获取私聊历史消息 |
| `qq_get_essence_msg_list` | 获取精华消息列表 |

### 互动工具

| 工具 | 功能 |
|------|------|
| `qq_poke` | 戳一戳 |
| `qq_recall_message` | 撤回消息 ⚠️ |
| `qq_set_msg_emoji_like` | 表情回应 |
| `qq_ocr_image` | OCR 图片识别 |
| `qq_translate_en2zh` | 英译中 |
| `qq_mark_msg_as_read` | 标记已读 |

### 消息发送

| 工具 | 功能 |
|------|------|
| `qq_send_message` | 发送文本/图片/语音/视频 |
| `qq_upload_file` | 上传文件 |
| `qq_forward_message` | 转发消息 |
| `qq_send_group_forward_msg` | 群合并转发 |
| `qq_send_private_forward_msg` | 私聊合并转发 |
| `qq_download_file` | 下载文件 ⚠️ |

### 精华消息

| 工具 | 功能 |
|------|------|
| `qq_set_essence_msg` | 设置精华消息 ⚠️ |
| `qq_delete_essence_msg` | 移除精华消息 ⚠️ |

### 好友管理

| 工具 | 功能 |
|------|------|
| `qq_set_friend_remark` | 设置好友备注 ⚠️ |
| `qq_delete_friend` | 删除好友 ⚠️ |

### 群管理

| 工具 | 功能 |
|------|------|
| `qq_mute_group_member` | 禁言 ⚠️ |
| `qq_kick_group_member` | 踢人 ⚠️ |
| `qq_set_group_card` | 设置群名片 ⚠️ |
| `qq_set_group_admin` | 设置管理员 ⚠️ |
| `qq_set_group_name` | 修改群名 ⚠️ |
| `qq_set_group_whole_ban` | 全员禁言 ⚠️ |
| `qq_set_group_special_title` | 专属头衔 ⚠️ |
| `qq_set_group_leave` | 退出群聊 ⚠️ |
| `qq_set_group_portrait` | 设置群头像 ⚠️ |
| `qq_set_group_sign` | 群签到 |
| `qq_set_group_remark` | 设置群备注 ⚠️ |
| `qq_get_group_at_all_remain` | 查询 @全体 剩余次数 |

### 群公告

| 工具 | 功能 |
|------|------|
| `qq_send_group_notice` | 发送公告 ⚠️ |
| `qq_get_group_notice` | 获取公告列表 |
| `qq_delete_group_notice` | 删除公告 ⚠️ |

### 群文件

| 工具 | 功能 |
|------|------|
| `qq_get_group_root_files` | 获取文件列表 |
| `qq_get_group_file_url` | 获取文件下载链接 |
| `qq_create_group_file_folder` | 创建文件夹 ⚠️ |
| `qq_delete_group_file` | 删除文件 ⚠️ |

### 请求处理

| 工具 | 功能 |
|------|------|
| `qq_handle_friend_request` | 处理好友请求 ⚠️ |
| `qq_handle_group_request` | 处理加群请求 ⚠️ |

> ⚠️ 标记表示该操作需要管理员权限

---

## 💬 使用示例

配置完成后，直接在 QQ 中与 AI 对话即可：

- "帮我给 3870871935 点赞" → 调用 `qq_like_user`
- "帮我分析 @某人 的签名" → 提取 QQ 号，调用 `qq_get_user_info`
- "查看群成员列表" → 调用 `qq_get_group_member_list`
- "把 @某人 禁言10分钟" → 调用 `qq_mute_group_member`（需管理员）
- "发个群公告：明天开会" → 调用 `qq_send_group_notice`（需管理员）
- "识别一下这张图上的文字" → 调用 `qq_ocr_image`
- "看看群文件里有什么" → 调用 `qq_get_group_root_files`

---

## 📁 项目结构

```
.
├── index.ts                      # 插件入口
├── package.json                  # 包元数据
├── openclaw.plugin.json          # 插件元数据
└── src/
    ├── accounts.ts               # 多账号解析
    ├── api.ts                    # OneBot HTTP API 客户端
    ├── channel.ts                # Channel 插件定义
    ├── config-schema.ts          # JSON Schema 配置验证
    ├── monitor.ts                # WS 消息监听 + 速率限制
    ├── runtime.ts                # 运行时上下文
    ├── send.ts                   # 消息发送
    ├── tools.ts                  # 45 个工具函数
    ├── types.ts                  # TypeScript 类型定义
    ├── features/
    │   ├── group-hooks.ts        # 入退群事件钩子
    │   ├── keyword-matcher.ts    # 关键字触发引擎
    │   └── long-message.ts       # 长消息处理
    └── security/
        ├── access-control.ts     # 白名单/黑名单
        ├── admin-guard.ts        # 管理员权限守卫
        └── rate-limiter.ts       # 三级速率限制器
```

---

## 📄 许可证

MIT

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=lynn-521/openclaw-napcat&type=date&legend=top-left)](https://www.star-history.com/#lynn-521/openclaw-napcat&type=date&legend=top-left)

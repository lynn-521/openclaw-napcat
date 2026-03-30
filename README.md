# openclaw-napcat

[English](./README_EN.md) | 中文

[![npm](https://img.shields.io/npm/v/@lynn-521/napcat)](https://www.npmjs.com/package/@lynn-521/napcat)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

> **⚠️ 免责声明**：本插件由个人开发并开源，用于学习与研究目的。使用本插件产生的任何行为（如发送消息、群管理操作等）由使用者自行承担全部责任。开发者不对因使用本插件而造成的任何直接或间接损失负责。

OpenClaw 的 QQ 消息通道插件，基于 [NapCat](https://github.com/NapNeko/NapCatQQ) 的 OneBot 11 反向 WebSocket 协议。

让 AI 助手通过自然语言完全控制 QQ 交互 —— 点赞、戳一戳、禁言、踢人、查看用户资料、管理群组等。

## 功能特性

- **45 个 AI Agent 工具** —— AI 通过自然语言指令执行 QQ 操作
- **WebSocket 全双工通信** —— 消息收发均走 WS，性能更高，HTTP API 仅作降级
- **语音转文字 (STT)** —— 自动将语音消息转录为文字后发送给 AI
- **@提及识别** —— 自动识别消息中的 `@QQ号` 并映射到用户 ID
- **群管理** —— 完整的管理工具集：禁言、踢人、设置管理员、改群名、发公告
- **多账号支持** —— 支持配置多个 NapCat 机器人账号
- **速率限制** —— 三级限流：分钟/小时/天，防止恶意刷消息
- **管理员权限守卫** —— 高危操作需要管理员授权，非管理员无法执行
- **白名单/黑名单访问控制** —— 精细控制哪些用户和群可以与机器人交互，支持 allowlist 和 blocklist 两种模式

## Agent 工具列表

### 查询工具

| 工具 | 功能 | 仅群主 |
|------|------|:------:|
| `qq_like_user` | 给用户点赞 | |
| `qq_get_user_info` | 获取用户资料（昵称、年龄、签名等） | |
| `qq_get_group_info` | 获取群信息（群名、成员数） | |
| `qq_get_group_member_info` | 获取群内某成员的详细信息 | |
| `qq_get_friend_list` | 获取机器人好友列表 | |
| `qq_get_group_list` | 获取机器人群列表 | |
| `qq_get_group_member_list` | 获取群全部成员列表 | |
| `qq_get_group_honor_info` | 获取群荣誉信息（龙王等） | |

### 消息历史与上下文

| 工具 | 功能 | 仅群主 |
|------|------|:------:|
| `qq_get_group_msg_history` | 获取群聊历史消息 | |
| `qq_get_friend_msg_history` | 获取私聊历史消息 | |
| `qq_get_essence_msg_list` | 获取群精华消息列表 | |

### 互动工具

| 工具 | 功能 | 仅群主 |
|------|------|:------:|
| `qq_poke` | 戳一戳 | |
| `qq_recall_message` | 撤回消息 | Yes |
| `qq_set_msg_emoji_like` | 给消息添加表情回应 | |
| `qq_ocr_image` | OCR 图片文字识别 | |
| `qq_translate_en2zh` | 英译中翻译 | |
| `qq_mark_msg_as_read` | 标记消息为已读 | |

### 消息发送

| 工具 | 功能 | 仅群主 |
|------|------|:------:|
| `qq_send_message` | 发送文本/图片/语音/视频消息 | |
| `qq_upload_file` | 上传文件到群聊或私聊 | |
| `qq_forward_message` | 转发消息 | |
| `qq_send_group_forward_msg` | 发送群合并转发消息 | |
| `qq_send_private_forward_msg` | 发送私聊合并转发消息 | |
| `qq_download_file` | 下载文件到机器人本地 | Yes |

### 精华消息管理

| 工具 | 功能 | 仅群主 |
|------|------|:------:|
| `qq_set_essence_msg` | 设置精华消息 | Yes |
| `qq_delete_essence_msg` | 移除精华消息 | Yes |

### 好友管理

| 工具 | 功能 | 仅群主 |
|------|------|:------:|
| `qq_set_friend_remark` | 设置好友备注 | Yes |
| `qq_delete_friend` | 删除好友 | Yes |

### 群管理工具

| 工具 | 功能 | 仅群主 |
|------|------|:------:|
| `qq_mute_group_member` | 禁言群成员 | Yes |
| `qq_kick_group_member` | 踢出群成员 | Yes |
| `qq_set_group_card` | 设置群名片 | Yes |
| `qq_set_group_admin` | 设置/取消群管理员 | Yes |
| `qq_set_group_name` | 修改群名称 | Yes |
| `qq_set_group_whole_ban` | 全员禁言开关 | Yes |
| `qq_set_group_special_title` | 设置群成员专属头衔 | Yes |
| `qq_set_group_leave` | 退出群聊 | Yes |
| `qq_set_group_portrait` | 设置群头像 | Yes |
| `qq_set_group_sign` | 群签到打卡 | |
| `qq_set_group_remark` | 设置群备注 | Yes |
| `qq_get_group_at_all_remain` | 查询 @全体成员 剩余次数 | |

### 群公告管理

| 工具 | 功能 | 仅群主 |
|------|------|:------:|
| `qq_send_group_notice` | 发送群公告 | Yes |
| `qq_get_group_notice` | 获取群公告列表 | |
| `qq_delete_group_notice` | 删除群公告 | Yes |

### 群文件管理

| 工具 | 功能 | 仅群主 |
|------|------|:------:|
| `qq_get_group_root_files` | 获取群文件根目录列表 | |
| `qq_get_group_file_url` | 获取群文件下载链接 | |
| `qq_create_group_file_folder` | 创建群文件夹 | Yes |
| `qq_delete_group_file` | 删除群文件 | Yes |

### 请求处理

| 工具 | 功能 | 仅群主 |
|------|------|:------:|
| `qq_handle_friend_request` | 处理好友请求 | Yes |
| `qq_handle_group_request` | 处理加群请求 | Yes |

## 前置要求

- 已安装并运行 [OpenClaw](https://github.com/openclaw/openclaw)
- 已运行 [NapCat](https://github.com/NapNeko/NapCatQQ) 并开启 WebSocket（推荐）和 HTTP API（降级用）
- Node.js 22+

## 安装

**方式一：从 npm 安装（推荐）**

```bash
openclaw plugins install @lynn-521/napcat
```

**方式二：手动克隆**

```bash
cd ~/.openclaw/extensions
git clone https://github.com/lynn-521/openclaw-napcat.git napcat
cd napcat && npm install --omit=dev
```

## 配置

在 OpenClaw 配置中添加（`openclaw config edit`）：

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
      "whitelist": {
        "enabled": false,
        "mode": "blocklist",
        "allowUsers": [],
        "allowGroups": [],
        "blockUsers": [],
        "blockGroups": []
      }
    }
  }
}
```

### 通信方式

插件默认**优先使用 WebSocket 全双工通信**，消息发送和接收都通过同一个 WS 连接完成，性能更高且不依赖 HTTP API。

- `wsUrl` — WS 服务器地址（推荐），用于全双工通信
- `httpApi` — HTTP API 地址（可选），仅作为 WS 不可用时的降级方案

### 配置字段说明

| 字段 | 说明 |
|------|------|
| `wsUrl` | NapCat WebSocket 地址（推荐，用于全双工通信） |
| `httpApi` | NapCat HTTP API 地址（可选，WS 不可用时降级） |
| `accessToken` | API 鉴权 token（可选） |
| `selfId` | 机器人自身 QQ 号（用于 @机器人检测） |
| `dmPolicy` | 私聊策略：`allowlist` / `pairing` / `open` / `disabled` |
| `allowFrom` | 允许私聊的 QQ 号列表 |
| `groupPolicy` | 群聊策略：`allowlist` / `open` / `disabled` |
| `groupAllowFrom` | 允许在群聊中触发的 QQ 号列表 |
| `rateLimit` | 速率限制配置 |
| `rateLimit.enabled` | 是否启用速率限制（默认 true） |
| `rateLimit.maxPerMinute` | 每分钟最大消息数（默认 20） |
| `rateLimit.maxPerHour` | 每小时最大消息数（默认 500） |
| `rateLimit.maxPerDay` | 每天最大消息数（默认 3000） |
| `admins` | 管理员 QQ 号列表，可执行所有操作（包括高危操作） |
| `whitelist.enabled` | 是否启用白名单/黑名单访问控制（默认 false） |
| `whitelist.mode` | 模式：`allowlist`=仅允许名单，`blocklist`=允许所有但排除黑名单（默认 blocklist） |
| `whitelist.allowUsers` | allowlist 模式下允许的私聊用户 QQ 号列表 |
| `whitelist.allowGroups` | allowlist 模式下允许的群 ID 列表 |
| `whitelist.blockUsers` | blocklist 模式下禁止的私聊用户 QQ 号列表 |
| `whitelist.blockGroups` | blocklist 模式下禁止的群 ID 列表 |

**重要：** 需要在 OpenClaw 配置中将 `tools.profile` 设置为 `"full"`，否则 `qq_*` 工具会被默认的 `"coding"` profile 过滤掉。

## 使用示例

配置完成后，直接在 QQ 中与 AI 对话即可：

- "帮我给 3870871935 点赞" —— AI 调用 `qq_like_user`
- "帮我分析 @某人 的签名" —— AI 从 @提及中提取 QQ 号，调用 `qq_get_user_info`
- "查看群成员列表" —— AI 调用 `qq_get_group_member_list`
- "把 @某人 禁言10分钟" —— AI 调用 `qq_mute_group_member`（仅群主）
- "发个群公告：明天开会" —— AI 调用 `qq_send_group_notice`（仅群主）
- "查看群里最近的聊天记录" —— AI 调用 `qq_get_group_msg_history`
- "把这条消息设为精华" —— AI 调用 `qq_set_essence_msg`（仅群主）
- "识别一下这张图上的文字" —— AI 调用 `qq_ocr_image`
- "看看群文件里有什么" —— AI 调用 `qq_get_group_root_files`

## 语音消息

启用语音 STT 后（`tools.media.audio.enabled: true`），语音消息会自动转录为文字再发送给 AI 模型。

## 项目结构

```
.
├── index.ts                 # 插件入口
├── package.json
├── openclaw.plugin.json     # 插件元数据
└── src/
    ├── accounts.ts          # 多账号解析
    ├── api.ts               # OneBot 11 HTTP API 客户端
    ├── channel.ts           # Channel 插件与 Dock 定义
    ├── config-schema.ts     # 配置 JSON Schema + UI 提示
    ├── monitor.ts           # WebSocket 消息监听 + STT + 速率限制
    ├── probe.ts             # 连接探测 / 健康检查
    ├── runtime.ts           # 运行时上下文 + 发送者上下文管理
    ├── security/            # 安全模块
    │   ├── access-control.ts  # 白名单/黑名单访问控制
    │   ├── admin-guard.ts   # 管理员权限守卫
    │   └── rate-limiter.ts  # 三级速率限制器
    ├── send.ts              # 消息发送
    ├── tools.ts             # 45 个 AI Agent 工具（含管理员守卫）
    └── types.ts             # TypeScript 类型定义
```

## 许可证

MIT

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=lynn-521/openclaw-napcat&type=date&legend=top-left)](https://www.star-history.com/#lynn-521/openclaw-napcat&type=date&legend=top-left)

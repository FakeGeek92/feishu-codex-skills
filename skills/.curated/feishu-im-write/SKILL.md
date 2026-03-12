---
name: feishu-im-write
description: |
  飞书用户身份消息发送工具使用指南，覆盖发送消息、回复消息，以及发送前的安全确认边界。

  **当以下情况时使用此 Skill**:
  (1) 用户明确要求“以我自己的身份”给某个人或某个群发消息
  (2) 用户明确要求回复某条飞书消息
  (3) 已经确认发送对象和最终消息内容
  (4) 用户提到“帮我给这个群发一下”“替我回一句”“用我的身份发”
---

# 飞书用户身份发消息

## Standalone Wrapper

- 共享环境变量：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`，可选 `FEISHU_BASE_URL`、`FEISHU_OAUTH_STORE_DIR`
- `feishu_im_user_message` -> `node scripts/im-write.js '<json>'`
- 该 skill 需要 `im:message.send_as_user`
- 如果你执行 `feishu-troubleshoot` 的 `preauth_all`，当前仓库会把这个 scope 一并申请；授权前先确认你接受“以本人身份发消息”这一权限

## 执行前必读

- 本 skill 只能在用户明确要求“以本人身份发送或回复”时使用
- 调用前必须确认两件事：发送对象是谁，最终发送内容是什么
- `content` 必须是合法 JSON 字符串，格式由 `msg_type` 决定
- 如果只是查聊天记录或找消息，不要用这里，改用 `feishu-im-read`

## 快速索引：意图 → 工具 → 必填参数

| 用户意图 | 工具 | 必填参数 | 常用可选 |
|---------|------|---------|---------|
| 给个人或群发送消息 | `feishu_im_user_message` | `action="send"`, `receive_id_type`, `receive_id`, `msg_type`, `content` | `uuid` |
| 回复某条消息 | `feishu_im_user_message` | `action="reply"`, `message_id`, `msg_type`, `content` | `reply_in_thread`, `uuid` |

## 核心约束（Schema 未透露的知识）

### 1. 这是“真发送”，发送者就是用户本人

- 对方看到的发送者不是机器人，而是当前授权用户
- 所以没有明确授权时，不能擅自调用
- 如果用户只是要你“起草一段话”，先给文案，不要直接发

### 2. `send` 和 `reply` 的目标锚点不同

| 动作 | 关键锚点 |
|------|---------|
| `send` | `receive_id_type` + `receive_id` |
| `reply` | `message_id` |

`send` 常见目标：

- `receive_id_type="open_id"` -> 私聊某个人
- `receive_id_type="chat_id"` -> 发到群里

### 3. `content` 是 JSON 字符串，不是普通文本

最常用的 `text` 示例：

```json
{"text":"你好"}
```

这段内容在传参时要作为字符串整体传入，例如：

```json
"{\"text\":\"你好\"}"
```

### 4. `uuid` 是幂等键，适合避免重复发送

同一个 `uuid` 在约 1 小时内只会发送一条消息。对重试场景很有用。

### 5. `reply_in_thread` 会改变消息落点

- `false` 或不传：回复出现在聊天主流
- `true`：回复进该消息的话题线程

如果用户说“回到主会话里”，不要误开线程回复。

## 使用场景示例

### 场景 1：给群里发送一条文本消息

```json
{
  "action": "send",
  "receive_id_type": "chat_id",
  "receive_id": "oc_xxx",
  "msg_type": "text",
  "content": "{\"text\":\"今天 3 点开始评审。\"}"
}
```

### 场景 2：私聊某个用户

```json
{
  "action": "send",
  "receive_id_type": "open_id",
  "receive_id": "ou_xxx",
  "msg_type": "text",
  "content": "{\"text\":\"我稍后给你回。\"}"
}
```

### 场景 3：按线程回复某条消息

```json
{
  "action": "reply",
  "message_id": "om_xxx",
  "msg_type": "text",
  "content": "{\"text\":\"收到，我今天处理。\"}",
  "reply_in_thread": true
}
```

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| 发错对象 | 没先确认 `receive_id` 或 `message_id` | 发之前先和用户确认收件人或原消息 |
| `content` 解析失败 | 传的是普通文本，不是 JSON 字符串 | 按 `msg_type` 构造合法 JSON 字符串 |
| 消息重复发出 | 重试时没带 `uuid` | 给重试场景补幂等 `uuid` |
| 用户只想看聊天记录 | 用错了 skill | 读取历史请切到 `feishu-im-read` |

## 官方文档参考

- 消息与群组 API 总览: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1`
- 发送消息: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create`
- 回复消息: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/reply`

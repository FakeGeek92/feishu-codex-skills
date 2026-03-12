---
name: feishu-chat
description: |
  飞书群聊与会话元数据查询工具使用指南，覆盖搜索会话、查看群详情、列出群成员。

  **当以下情况时使用此 Skill**:
  (1) 需要根据关键词找群聊或确认群 ID
  (2) 需要查看某个群的名称、描述、群主、权限配置
  (3) 需要列出某个群的成员
  (4) 用户提到“这个群叫什么”“帮我找群”“看看群里有哪些人”
---

# 飞书群聊与会话查询

## Standalone Wrapper

- 共享环境变量：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`，可选 `FEISHU_BASE_URL`、`FEISHU_OAUTH_STORE_DIR`
- `feishu_chat` -> `node scripts/chat.js chat '<json>'`
- `feishu_chat_members` -> `node scripts/chat.js members '<json>'`

## 执行前必读

- 本 skill 只查“会话容器信息”，不读取消息正文，不发送消息
- 查群详情和列成员都依赖 `chat_id`；不知道 `chat_id` 时先用 `search`
- `user_id_type` / `member_id_type` 默认都是 `open_id`
- 成员列表默认不返回机器人；如果用户要看聊天内容，应该改用 `feishu-im-read`

## 快速索引：意图 → 工具 → 必填参数

| 用户意图 | 工具 | 必填参数 | 常用可选 |
|---------|------|---------|---------|
| 按名称或成员搜群 | `feishu_chat` | `action="search"`, `query` | `page_size`, `page_token`, `user_id_type` |
| 看群详情 | `feishu_chat` | `action="get"`, `chat_id` | `user_id_type` |
| 列出群成员 | `feishu_chat_members` | `chat_id` | `member_id_type`, `page_size`, `page_token` |

## 核心约束（Schema 未透露的知识）

### 1. 这是“群资料查询”，不是“消息查询”

- `search` 搜的是群名称和群成员匹配，不是历史消息
- `get` 返回的是群元数据，例如名称、描述、群主、权限配置
- `members` 返回的是成员清单，不会替代聊天记录

### 2. `search` 的关键词会同时匹配群名和成员名

- 如果用户只记得群里某个人，也可以搜到对应群
- 搜索结果是“当前用户可见的群”，不是租户全量群
- 结果多时必须依赖 `page_token` 继续翻页

### 3. `chat_id` 是后续一切精确查询的锚点

| 参数 | 格式 | 用途 |
|------|------|------|
| `chat_id` | `oc_xxx` | 获取群详情、获取群成员 |
| `query` | 自然语言关键词 | 先找到可能的群，再拿到 `chat_id` |

如果用户给的是群名称而不是 `chat_id`，先 `search` 再 `get`。

### 4. 群成员接口不返回机器人

这是飞书成员列表接口本身的返回边界。若用户要求确认“机器人是否在群里”或“谁发了消息”，不能只靠这个接口。

## 使用场景示例

### 场景 1：按关键词搜索群聊

```json
{
  "action": "search",
  "query": "项目组",
  "page_size": 20
}
```

### 场景 2：获取指定群详情

```json
{
  "action": "get",
  "chat_id": "oc_xxx"
}
```

### 场景 3：列出群成员

```json
{
  "chat_id": "oc_xxx",
  "page_size": 50
}
```

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| 搜不到目标群 | 群对当前用户不可见，或关键词太弱 | 换群名全称、成员名，必要时翻页 |
| 只有群信息没有消息 | 这个 skill 只查群资料 | 消息历史改用 `feishu-im-read` |
| 群成员数量对不上 | 接口不返回机器人，或未翻页 | 检查 `has_more`，并向用户说明机器人不在结果里 |
| `chat_id` 格式不对 | 不是 `oc_xxx` | 先用 `search` 拿到真实 `chat_id` |

## 官方文档参考

- 消息与群组 API 总览: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1`
- 搜索群信息: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat/search`
- 获取群信息: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat/get`
- 获取群成员列表: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-members/get`

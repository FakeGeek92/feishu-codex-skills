---
name: feishu-user
description: |
  飞书用户与身份查询工具使用指南，覆盖当前用户信息、按 ID 获取指定用户、关键词搜索用户。

  **当以下情况时使用此 Skill**:
  (1) 需要确认当前登录的飞书用户是谁
  (2) 需要根据 open_id / union_id / user_id 查询指定用户资料
  (3) 需要按姓名、手机号、邮箱搜索用户
  (4) 用户提到“查下这个人是谁”“搜一下同事”“看下我当前登录的是谁”
---

# 飞书用户与身份查询

## Standalone Wrapper

- 共享环境变量：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`，可选 `FEISHU_BASE_URL`、`FEISHU_OAUTH_STORE_DIR`
- 用户授权会持久化到共享 token store；同一 `FEISHU_APP_ID` 下其他已安装 skill 会复用，不需要重复授权
- `feishu_get_user` -> `node scripts/user.js get-user '<json>'`
- `feishu_search_user` -> `node scripts/user.js search-user '<json>'`

## 执行前必读

- 本 skill 只做“用户身份信息查询”，不读聊天记录，也不发消息
- `feishu_get_user` 不传 `user_id` 时获取“当前登录用户”；传了 `user_id` 时获取“指定用户”
- `user_id_type` 默认 `open_id`；除非你明确拿到的是 `union_id` 或 `user_id`，否则不要改
- 所有结果都受当前用户的组织架构可见范围影响；看不到的人，工具也查不到

## 快速索引：意图 → 工具 → 必填参数

| 用户意图 | 工具 | 必填参数 | 常用可选 |
|---------|------|---------|---------|
| 看当前登录的是谁 | `feishu_get_user` | 无 | - |
| 查某个指定用户 | `feishu_get_user` | `user_id` | `user_id_type` |
| 按关键词搜人 | `feishu_search_user` | `query` | `page_size`, `page_token` |

## 核心约束（Schema 未透露的知识）

### 1. “当前用户” 和 “指定用户” 走的是两套接口

- 不传 `user_id` 时，底层走的是“获取登录用户信息”接口，适合确认当前 OAuth 身份
- 传 `user_id` 时，底层走的是通讯录用户查询接口，适合查同事资料
- 这两种返回结构相近，但语义不同；不要把“当前用户查询”误当成“任意用户查询”

### 2. `user_id_type` 只有在你真的知道 ID 类型时才改

| 类型 | 典型格式 | 适用场景 |
|------|---------|---------|
| `open_id` | `ou_xxx` | 默认选项，绝大多数场景都应优先用它 |
| `union_id` | `on_xxx` | 已明确拿到 union_id 时使用 |
| `user_id` | 自定义或企业内用户 ID | 只有明确知道是这一类 ID 时才使用 |

传错 `user_id_type` 常见表现是“查不到人”或返回权限错误。

### 3. 搜人不是精确过滤，而是关键词搜索

- `feishu_search_user` 适合姓名、手机号、邮箱的模糊检索
- 结果按搜索相关性返回，不保证是你心里那个人排第一
- 搜索结果多时要检查 `has_more` 和 `page_token`

### 4. 41050 不是 token 坏了，而是组织架构不可见

如果当前用户看不到某个同事的组织架构，按指定用户查询时会直接失败。这个限制来自“当前用户可见范围”，不是应用的全局通讯录权限。

## 使用场景示例

### 场景 1：确认当前登录用户

```json
{}
```

### 场景 2：按 open_id 查询指定同事

```json
{
  "user_id": "ou_xxx",
  "user_id_type": "open_id"
}
```

### 场景 3：按关键词搜索用户并翻页

首次请求：

```json
{
  "query": "张三",
  "page_size": 20
}
```

继续翻页：

```json
{
  "query": "张三",
  "page_size": 20,
  "page_token": "xxx"
}
```

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| 查指定用户失败，但当前用户能查到 | 目标用户超出当前用户组织架构可见范围 | 让用户确认自己在飞书里是否能看到该同事 |
| 搜索结果里没有想找的人 | 关键词太短或不是姓名/手机号/邮箱 | 换更完整的关键词，必要时翻页 |
| `open_id` 查不到人 | `user_id_type` 传错 | 明确拿到 `ou_xxx` 时用 `open_id` |
| 误把这个 skill 用来找群或消息 | skill 边界用错 | 群信息用 `feishu-chat`，消息历史用 `feishu-im-read` |

## 官方文档参考

- 通讯录 API 总览: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/contact-v3`
- 获取登录用户信息: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/user_info/get`
- 获取单个用户信息: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/contact-v3/user/get`
- 搜索用户: `https://open.feishu.cn/document/ukTMukTMukTM/uMTM4UjLzEDO14yMxgTN`

---
name: feishu-doc-comments
description: |
  飞书云文档评论管理工具使用指南，覆盖列评论、创建全文评论、解决或恢复评论。

  **当以下情况时使用此 Skill**:
  (1) 需要查看某个文档或表格上的评论线程
  (2) 需要在文档上新增一条全文评论
  (3) 需要把评论标记为已解决或恢复未解决
  (4) 用户提到“这篇文档有哪些评论”“帮我留言提醒一下”“把这条评论解决掉”
---

# 飞书云文档评论管理

## Standalone Wrapper

- 共享环境变量：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`，可选 `FEISHU_BASE_URL`、`FEISHU_OAUTH_STORE_DIR`
- `feishu_doc_comments` -> `node scripts/doc-comments.js '<json>'`

## 执行前必读

- 本 skill 只处理“文档评论线程”，不编辑正文文本
- `create` 创建的是“全文评论”，不是带锚点的选区批注
- `file_token` 可以直接是文档 token；如果 `file_type="wiki"`，工具会自动先解析成实际文档对象
- `patch` 只支持解决/恢复评论，不支持改写评论正文

## 快速索引：意图 → 工具 → 必填参数

| 用户意图 | 工具 | 必填参数 | 常用可选 |
|---------|------|---------|---------|
| 看评论列表 | `feishu_doc_comments` | `action="list"`, `file_token`, `file_type` | `is_whole`, `is_solved`, `page_size`, `page_token` |
| 创建评论 | `feishu_doc_comments` | `action="create"`, `file_token`, `file_type`, `elements` | `user_id_type` |
| 解决或恢复评论 | `feishu_doc_comments` | `action="patch"`, `file_token`, `file_type`, `comment_id`, `is_solved_value` | `user_id_type` |

## 核心约束（Schema 未透露的知识）

### 1. `wiki` token 会先解析，再操作真实文档

- 当 `file_type="wiki"` 时，工具不会直接拿 wiki 节点去调评论接口
- 它会先查 wiki 节点信息，把 `node_token` 解析成真实的 `obj_token` 和 `obj_type`
- 如果这个 wiki 节点其实是目录，而不是文档，解析就会失败

### 2. `create` 是全文评论，不是正文选区评论

这意味着：

- 适合“留一条提醒”或“针对整份文档给评论”
- 不适合“给第 3 段第 2 句打批注”这种精确锚点场景
- 如果用户要改正文或插入内容，应该转到 `feishu-update-doc`

### 3. 评论内容由 `elements` 数组组成

支持三种元素：

| 类型 | 必填字段 | 含义 |
|------|---------|------|
| `text` | `text` | 纯文本 |
| `mention` | `open_id` | @ 某个用户 |
| `link` | `url` | 插入文档链接或外部链接 |

工具会把它们转换成飞书评论内容结构。

### 4. `list` 会主动补齐回复

飞书原生评论列表接口可能只返回部分回复。本 skill 会额外请求回复列表，尽量返回完整的评论线程上下文。

## 使用场景示例

### 场景 1：列出文档评论

```json
{
  "action": "list",
  "file_token": "dox_xxx",
  "file_type": "docx",
  "page_size": 50
}
```

### 场景 2：在文档上创建一条提醒评论

```json
{
  "action": "create",
  "file_token": "dox_xxx",
  "file_type": "docx",
  "elements": [
    { "type": "text", "text": "请确认这里的数据口径。" },
    { "type": "mention", "open_id": "ou_xxx" }
  ]
}
```

### 场景 3：解决某条评论

```json
{
  "action": "patch",
  "file_token": "dox_xxx",
  "file_type": "docx",
  "comment_id": "comment_xxx",
  "is_solved_value": true
}
```

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| wiki 文档评论失败 | 给的是目录节点，不是真实文档节点 | 先用 `feishu-wiki` 的 `get` 确认节点类型 |
| 新增评论后没出现在某段旁边 | 这个 skill 只支持全文评论 | 如果要操作正文内容，改用文档内容类 skill |
| `patch` 失败 | 漏传 `comment_id` 或 `is_solved_value` | 两个字段都必须给 |
| 评论列表里的回复不全 | 没有继续翻页，或接口本身有更多回复 | 检查 `has_more` 和 `page_token` |

## 官方文档参考

- 新版文档开放能力访问指南: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/docs/upgraded-docs-access-guide/upgraded-docs-openapi-access-guide`
- 获取云文档所有评论: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/file-comment/list`
- 添加全文评论: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/file-comment/create`
- 解决或恢复评论: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/file-comment/patch`
- 获取评论回复: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/file-comment-reply/list`

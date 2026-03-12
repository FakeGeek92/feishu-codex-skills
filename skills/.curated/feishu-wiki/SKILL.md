---
name: feishu-wiki
description: |
  飞书知识库结构管理工具使用指南，覆盖知识空间查询、节点查询、节点创建、移动、复制。

  **当以下情况时使用此 Skill**:
  (1) 需要列出知识库空间或查看某个知识库信息
  (2) 需要查看 wiki 节点详情或把 wiki 节点转换成底层文档 token
  (3) 需要在知识库里创建文档节点、移动节点、复制节点
  (4) 用户提到“知识库”“wiki 节点”“把这篇文档挂到知识库里”“移动目录结构”
---

# 飞书知识库结构管理

## Standalone Wrapper

- 共享环境变量：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`，可选 `FEISHU_BASE_URL`、`FEISHU_OAUTH_STORE_DIR`
- `feishu_wiki_space` -> `node scripts/wiki.js space '<json>'`
- `feishu_wiki_space_node` -> `node scripts/wiki.js node '<json>'`

## 执行前必读

- 本 skill 管的是“知识库层级结构”，不是底层文档正文内容
- `space_id`、`node_token`、`obj_token` 是三种不同层级的标识，不要混用
- `get` 是最重要的“解析动作”：可以把 wiki 节点解析成真实文档对象
- `move` / `copy` 改的是知识库树结构，不是原文内容

## 快速索引：意图 → 工具 → 必填参数

| 用户意图 | 工具 | 必填参数 | 常用可选 |
|---------|------|---------|---------|
| 列知识空间 | `feishu_wiki_space` | `action="list"` | `page_size`, `page_token` |
| 看知识空间详情 | `feishu_wiki_space` | `action="get"`, `space_id` | - |
| 创建知识空间 | `feishu_wiki_space` | `action="create"` | `name`, `description` |
| 列节点 | `feishu_wiki_space_node` | `action="list"`, `space_id` | `parent_node_token`, `page_size`, `page_token` |
| 获取节点详情 / 解析底层对象 | `feishu_wiki_space_node` | `action="get"`, `token` | `obj_type` |
| 创建节点 | `feishu_wiki_space_node` | `action="create"`, `space_id`, `obj_type` | `parent_node_token`, `node_type`, `origin_node_token`, `title` |
| 移动节点 | `feishu_wiki_space_node` | `action="move"`, `space_id`, `node_token` | `target_parent_token` |
| 复制节点 | `feishu_wiki_space_node` | `action="copy"`, `space_id`, `node_token` | `target_space_id`, `target_parent_token`, `title` |

## 核心约束（Schema 未透露的知识）

### 1. `space_id`、`node_token`、`obj_token` 不是一个东西

| 标识 | 含义 |
|------|------|
| `space_id` | 知识空间本身的 ID |
| `node_token` | 知识库树上的节点 ID |
| `obj_token` | 节点底层真实文档对象的 token |

用户给你 wiki URL 时，常见拿到的是 `node_token`，不是底层文档 token。

### 2. `get` 可以把 wiki 节点解析成底层对象

- 默认 `obj_type` 用 `wiki`
- 对 wiki 节点执行 `get` 后，返回里通常能看到 `obj_token` 和 `obj_type`
- 这一步经常是连接 `feishu-wiki` 和 `feishu-fetch-doc` / `feishu-sheet` / `feishu-doc-comments` 的桥梁

### 3. 节点创建既可以建原生节点，也可以建快捷方式

| 参数 | 含义 |
|------|------|
| `node_type="origin"` | 创建普通知识库节点 |
| `node_type="shortcut"` | 创建快捷方式 |
| `origin_node_token` | 创建快捷方式时指向原节点 |

如果用户只说“把这篇文档挂到知识库”，需要先判断是新建文档节点，还是挂一个 shortcut。

### 4. 这个 skill 不修改正文

它只负责知识库结构、归档位置、节点复制移动。正文内容更新要转给文档类或表格类 skill。

## 使用场景示例

### 场景 1：列出知识空间

```json
{
  "action": "list",
  "page_size": 20
}
```

### 场景 2：解析 wiki 节点，拿到底层对象

```json
{
  "action": "get",
  "token": "wik_xxx",
  "obj_type": "wiki"
}
```

### 场景 3：在知识空间里创建一个 docx 节点

```json
{
  "action": "create",
  "space_id": "123",
  "obj_type": "docx",
  "parent_node_token": "wik_parent_xxx",
  "title": "项目周报"
}
```

### 场景 4：把节点移动到另一个父目录下

```json
{
  "action": "move",
  "space_id": "123",
  "node_token": "wik_xxx",
  "target_parent_token": "wik_target_xxx"
}
```

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| 下游文档 skill 识别不了 wiki token | 还没做节点解析 | 先用 `feishu_wiki_space_node.get` 拿 `obj_token` |
| 创建节点后不是新文档，而是快捷方式 | `node_type` 传成了 `shortcut` | 明确区分 `origin` 和 `shortcut` |
| 移动或复制失败 | `space_id` / `node_token` / `target_parent_token` 混用 | 先用 `get` / `list` 把每个 ID 类型确认清楚 |
| 用户想改文档正文 | skill 边界用错 | 文档正文用 `feishu-fetch-doc` / `feishu-update-doc` / `feishu-sheet` |

## 官方文档参考

- 知识库概述: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/wiki-overview`
- 获取知识空间列表: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/wiki-v2/space/list`
- 获取知识空间节点信息: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/wiki-v2/space/get_node`
- 创建知识空间节点: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/wiki-v2/space-node/create`
- 移动知识空间节点: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/wiki-v2/space-node/move`

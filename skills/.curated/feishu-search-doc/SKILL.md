---
name: feishu-search-doc
description: |
  飞书文档与 Wiki 统一搜索工具使用指南，覆盖关键词搜索、类型筛选、创建者筛选、时间筛选与空搜。

  **当以下情况时使用此 Skill**:
  (1) 需要在飞书里按关键词找文档或 wiki 节点
  (2) 需要按创建者、文档类型、标题、时间范围过滤搜索结果
  (3) 需要做“空搜”看最近编辑或最近打开的文档
  (4) 用户提到“搜一下文档”“找最近改过的周报”“只查标题里有 OKR 的文档”
---

# 飞书文档与 Wiki 搜索

## Standalone Wrapper

- 共享环境变量：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`，可选 `FEISHU_BASE_URL`、`FEISHU_OAUTH_STORE_DIR`
- `feishu_search_doc_wiki` -> `node scripts/search-doc.js '<json>'`

## 执行前必读

- 本 skill 只返回搜索结果摘要，不返回完整正文内容
- `query` 可以为空；空字符串代表“空搜”，常用于按最近打开或最近编辑排序
- `filter` 会同时作用于文档和 Wiki；如果不传，工具仍会给两个空过滤器以满足飞书 API 要求
- 返回结果里的时间字段会被标准化成 `+08:00` 的 ISO 8601 字符串

## 快速索引：意图 → 工具 → 必填参数

| 用户意图 | 工具 | 必填参数 | 常用可选 |
|---------|------|---------|---------|
| 按关键词搜文档 | `feishu_search_doc_wiki` | `action="search"` | `query`, `page_size`, `page_token` |
| 只搜某些文档类型 | `feishu_search_doc_wiki` | `action="search"` | `filter.doc_types`, `filter.only_title` |
| 按创建者或时间过滤 | `feishu_search_doc_wiki` | `action="search"` | `filter.creator_ids`, `filter.create_time`, `filter.open_time`, `filter.sort_type` |
| 看最近编辑 / 最近打开的文档 | `feishu_search_doc_wiki` | `action="search"` | 空 `query` + `filter.sort_type` |

## 核心约束（Schema 未透露的知识）

### 1. `query` 为空不是错误，而是一种能力

- 不传 `query` 或传空字符串时，等价于空搜
- 空搜最适合配合 `sort_type` 使用，例如按最近编辑时间取回最近文档
- 这和传统“必须有关键词”的搜索工具不一样

### 2. `filter` 会镜像到 doc 和 wiki 两边

底层请求会同时构造：

- `doc_filter`
- `wiki_filter`

两边内容一致。也就是说，筛选条件不是只对 doc 生效，而是对文档和 Wiki 一起生效。

### 3. 搜索结果不是正文全文

返回结果通常包含：

- 标题
- 摘要
- 命中高亮
- 文档元数据

如果用户需要“把文档完整拉下来”，下一步应切到 `feishu-fetch-doc` 或相关内容 skill。

### 4. 时间和排序最容易被误用

| 字段 | 含义 |
|------|------|
| `filter.open_time` | 按打开时间过滤 |
| `filter.create_time` | 按创建时间过滤 |
| `filter.sort_type` | 排序规则，最常用 `EDIT_TIME` |

搜索结果中的 `*_time` 字段会被转成可读的 ISO 8601 时间。

## 使用场景示例

### 场景 1：普通关键词搜索

```json
{
  "action": "search",
  "query": "周报",
  "page_size": 10
}
```

### 场景 2：只搜标题，限定文档类型

```json
{
  "action": "search",
  "query": "OKR",
  "filter": {
    "doc_types": ["DOCX", "WIKI"],
    "only_title": true
  }
}
```

### 场景 3：空搜最近编辑的文档

```json
{
  "action": "search",
  "filter": {
    "sort_type": "EDIT_TIME"
  },
  "page_size": 10
}
```

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| 搜索结果里没有正文全文 | 这是搜索摘要接口 | 想看全文请转到 `feishu-fetch-doc` |
| 只搜出文档，没搜出想要的 wiki | 过滤条件过严，或关键词只命中文档侧 | 放宽 `doc_types` / `only_title` / 时间过滤 |
| 搜索出来时间看不懂 | 原始时间戳已被工具转成 ISO 8601 | 直接按返回时间字符串使用即可 |
| 结果太少 | `page_size` 默认只有 15，且最大 20 | 检查 `has_more` 并继续翻页 |

## 官方文档参考

- 搜索能力总览: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/search-v2`
- 搜索文档与 Wiki: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/search-v2/doc_wiki/search`

---
name: feishu-sheet
description: |
  飞书电子表格工具使用指南，覆盖表格信息获取、读取、覆盖写入、追加、查找、创建、导出。

  **当以下情况时使用此 Skill**:
  (1) 需要查看某个电子表格有哪些工作表
  (2) 需要读取、写入、追加表格数据
  (3) 需要在工作表中查找关键字
  (4) 需要创建新表格或导出为 xlsx / csv
  (5) 用户提到“Sheet”“电子表格”“单元格”“导出 Excel”“wiki 里的表格”
---

# 飞书电子表格管理

## Standalone Wrapper

- 共享环境变量：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`，可选 `FEISHU_BASE_URL`、`FEISHU_OAUTH_STORE_DIR`
- `feishu_sheet` -> `node scripts/sheet.js '<json>'`

## 执行前必读

- 本 skill 面向飞书电子表格，不是多维表格；Airtable 风格数据请改用 `feishu-bitable`
- `create` 之外的所有动作都支持 `url` 或 `spreadsheet_token`，并支持 wiki URL / wiki token 自动解析
- `write` 是覆盖写入，高风险；用户没有明确同意时，不要把它当“append”用
- `read` 默认最多返回 200 行；大表请缩小 `range`

## 快速索引：意图 → 工具 → 必填参数

| 用户意图 | 工具 | 必填参数 | 常用可选 |
|---------|------|---------|---------|
| 看表格信息和工作表列表 | `feishu_sheet` | `action="info"` + `url` 或 `spreadsheet_token` | - |
| 读取数据 | `feishu_sheet` | `action="read"` + `url` 或 `spreadsheet_token` | `range`, `sheet_id`, `value_render_option` |
| 覆盖写入 | `feishu_sheet` | `action="write"` + `url` 或 `spreadsheet_token`, `values` | `range`, `sheet_id` |
| 追加行 | `feishu_sheet` | `action="append"` + `url` 或 `spreadsheet_token`, `values` | `range`, `sheet_id` |
| 查找单元格 | `feishu_sheet` | `action="find"`, `url` 或 `spreadsheet_token`, `sheet_id`, `find` | `range`, `search_by_regex`, `match_case` |
| 创建表格 | `feishu_sheet` | `action="create"`, `title` | `folder_token`, `headers`, `data` |
| 导出表格 | `feishu_sheet` | `action="export"`, `url` 或 `spreadsheet_token`, `file_extension` | `output_path`, `sheet_id` |

## 核心约束（Schema 未透露的知识）

### 1. 支持 wiki URL / wiki token 自动解析

- 如果用户给的是知识库里的表格链接，工具会先把 wiki 节点解析成真实 `spreadsheet_token`
- 这也是为什么 `url` 和 `spreadsheet_token` 二选一即可
- 对用户来说，最稳的是直接给完整表格 URL

### 2. `info` 一次返回两类信息

- 表格基础信息
- 全部工作表清单

后续 `read` / `write` / `find` 里需要的 `sheet_id`，通常都应该先从 `info` 拿。

### 3. `read` 有默认截断保护

- 不指定 `range` 时，默认读取第一个工作表
- 结果最多返回 200 行；超过时会返回 `truncated` 和提示信息
- 大表应尽量用显式 `range`，例如 `sheet1!A1:D50`

### 4. `write` 和 `append` 不是一回事

| 动作 | 语义 |
|------|------|
| `write` | 覆盖写入指定范围；不填范围时从第一个工作表 `A1` 开始 |
| `append` | 在现有数据后追加行 |

写入边界：

- 单次最多 5000 行
- `write` 单行最多 100 列

### 5. 导出 CSV 和导出 XLSX 的约束不同

- `xlsx` 可以导整个表格
- `csv` 一次只能导一个工作表，因此必须给 `sheet_id`
- 如果给了 `output_path`，文件会直接落到本地；不填则只返回导出结果信息

## 使用场景示例

### 场景 1：获取表格信息

```json
{
  "action": "info",
  "spreadsheet_token": "sht_xxx"
}
```

### 场景 2：读取指定范围

```json
{
  "action": "read",
  "spreadsheet_token": "sht_xxx",
  "range": "sheet1!A1:C20"
}
```

### 场景 3：追加多行数据

```json
{
  "action": "append",
  "spreadsheet_token": "sht_xxx",
  "sheet_id": "sheet1",
  "values": [
    ["张三", "工程"],
    ["李四", "运营"]
  ]
}
```

### 场景 4：导出为 xlsx

```json
{
  "action": "export",
  "spreadsheet_token": "sht_xxx",
  "file_extension": "xlsx",
  "output_path": "/tmp/report.xlsx"
}
```

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| 读出来只有前 200 行 | 工具做了默认截断保护 | 缩小 `range`，分段读取 |
| 本来想追加，却把表头覆盖了 | 把 `write` 当成 `append` 用了 | 需要保留旧数据时改用 `append` |
| CSV 导出失败 | 没传 `sheet_id` | 导出 CSV 时必须指定工作表 |
| wiki 表格打不开 | 给的是 wiki URL，但没先解析 | 直接把 wiki URL 传给 tool，让它自动解析 |
| 用户说的是多维表格 | 产品边界搞错 | 切到 `feishu-bitable` |

## 官方文档参考

- 电子表格概述: `https://open.feishu.cn/document/ukTMukTMukTM/uATMzUjLwEzM14CMxMTN/overview`
- 创建电子表格: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/sheets-v3/spreadsheet/create`
- 获取电子表格信息: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/sheets-v3/spreadsheet/get`
- 读取单个范围: `https://open.feishu.cn/document/ukTMukTMukTM/ugTMzUjL4EzM14COxMTN`
- 向单个范围写入数据: `https://open.feishu.cn/document/ukTMukTMukTM/uAjMzUjLwIzM14CMyMTN`
- 追加数据: `https://open.feishu.cn/document/ukTMukTMukTM/uMjMzUjLzIzM14yMyMTN`
- 查找单元格: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/sheets-v3/spreadsheet-sheet/find`
- 创建导出任务: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/export_task/create`

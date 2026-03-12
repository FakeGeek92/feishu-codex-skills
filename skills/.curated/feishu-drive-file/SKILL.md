---
name: feishu-drive-file
description: |
  飞书云空间文件管理工具使用指南，覆盖列文件、查元数据、复制、移动、删除、上传、下载。

  **当以下情况时使用此 Skill**:
  (1) 需要查看云盘或某个文件夹下的文件列表
  (2) 需要获取文档或文件的元数据
  (3) 需要复制、移动、删除云空间文件
  (4) 需要把本地文件上传到飞书云空间，或把云空间文件下载到本地
  (5) 用户提到“云盘”“云空间”“文件夹”“上传附件到云盘”“下载这个飞书文件”
---

# 飞书云空间文件管理

## Standalone Wrapper

- 共享环境变量：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`，可选 `FEISHU_BASE_URL`、`FEISHU_OAUTH_STORE_DIR`
- `feishu_drive_file` -> `node scripts/drive-file.js '<json>'`

## 执行前必读

- 本 skill 管的是“云空间文件”，不是 IM 消息里的附件；消息附件请用 `feishu-im-read`
- `copy` / `move` / `delete` 都要求同时提供 `file_token` 和 `type`
- `get_meta` 使用 `request_docs` 数组，一次最多 50 个
- `upload` 优先用 `file_path`；只有在无法直接读本地文件时才用 `file_content_base64`

## 快速索引：意图 → 工具 → 必填参数

| 用户意图 | 工具 | 必填参数 | 常用可选 |
|---------|------|---------|---------|
| 列文件或列文件夹内容 | `feishu_drive_file` | `action="list"` | `folder_token`, `page_size`, `page_token`, `order_by`, `direction` |
| 批量查元数据 | `feishu_drive_file` | `action="get_meta"`, `request_docs` | - |
| 复制文件 | `feishu_drive_file` | `action="copy"`, `file_token`, `name`, `type` | `folder_token` |
| 移动文件 | `feishu_drive_file` | `action="move"`, `file_token`, `type`, `folder_token` | - |
| 删除文件 | `feishu_drive_file` | `action="delete"`, `file_token`, `type` | - |
| 上传本地文件 | `feishu_drive_file` | `action="upload"`, `file_path` 或 `file_content_base64` | `parent_node`, `file_name`, `size` |
| 下载文件 | `feishu_drive_file` | `action="download"`, `file_token` | `output_path` |

## 核心约束（Schema 未透露的知识）

### 1. 云空间文件和消息附件不是一回事

- `feishu-drive-file` 面向云盘、文档、文件夹
- 聊天消息中的 `file_key` / `image_key` 资源，不要拿来这里下载
- 如果用户说的是“群里那条消息里的文件”，应该转到 `feishu-im-read`

### 2. 根目录模式和文件夹模式行为不同

- `list` 不传 `folder_token` 或传空字符串时，列的是用户云空间根目录
- 根目录模式下，飞书原生返回行为和普通文件夹不完全一致，尤其是分页与快捷方式表现
- 如果用户要稳定分页结果，优先定位到具体 `folder_token`

### 3. `type` 不是可省略提示，而是写操作必填锚点

| 类型 | 典型对象 |
|------|---------|
| `doc` / `docx` | 文档 |
| `sheet` | 电子表格 |
| `bitable` | 多维表格 |
| `file` | 普通文件 |
| `folder` | 文件夹 |
| `mindnote` / `slides` | 思维笔记 / 幻灯片 |

传错 `type` 往往会导致 copy、move、delete 直接失败。

### 4. 上传有两种输入方式，但优先级不同

- 提供 `file_path` 时，工具会自动读文件、计算大小、提取文件名
- 只有在不能直接访问本地文件时，才使用 `file_content_base64`
- 使用 `file_content_base64` 时必须自己补齐 `file_name` 和 `size`

### 5. 下载既可以落地，也可以回传内容

- 提供 `output_path` 时，文件会保存到本地
- 不提供 `output_path` 时，工具返回 Base64 内容，更适合后续程序化处理

## 使用场景示例

### 场景 1：列出某个文件夹的文件

```json
{
  "action": "list",
  "folder_token": "fld_xxx",
  "page_size": 100
}
```

### 场景 2：批量获取元数据

```json
{
  "action": "get_meta",
  "request_docs": [
    { "doc_token": "sht_xxx", "doc_type": "sheet" },
    { "doc_token": "dox_xxx", "doc_type": "docx" }
  ]
}
```

### 场景 3：上传本地文件到云空间

```json
{
  "action": "upload",
  "parent_node": "fld_xxx",
  "file_path": "/tmp/spec.pdf"
}
```

### 场景 4：下载文件到本地

```json
{
  "action": "download",
  "file_token": "box_xxx",
  "output_path": "/tmp/spec.pdf"
}
```

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| 下载消息附件失败 | 把 IM 资源当成云空间文件 | 改用 `feishu-im-read` 的资源下载能力 |
| `copy` / `move` / `delete` 失败 | 漏传 `type` 或 `type` 不对 | 先用 `get_meta` 确认真实类型 |
| `get_meta` 报参数格式错误 | `request_docs` 不是数组或为空 | 传 `[{doc_token, doc_type}]` 结构 |
| Base64 上传失败 | 漏传 `file_name` 或 `size` | 改用 `file_path`，或把两个字段补齐 |
| 下载结果太大 | 未给 `output_path`，直接回传 Base64 | 对大文件优先写到本地路径 |

## 官方文档参考

- 云空间能力概述: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/files/guide/introduction`
- 文件夹中文件清单: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/file/list`
- 批量获取文件元数据: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/meta/batch_query`
- 上传文件: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/file/upload_all`
- 下载文件: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/file/download`

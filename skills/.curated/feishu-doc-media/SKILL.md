---
name: feishu-doc-media
description: |
  飞书新版文档媒体管理工具使用指南，覆盖向 docx 文档插入本地图片或文件、下载文档素材或画板缩略图。

  **当以下情况时使用此 Skill**:
  (1) 需要把本地图片插入到飞书新版文档
  (2) 需要把本地文件作为附件插入到 docx 文档
  (3) 需要下载文档素材或画板缩略图到本地
  (4) 用户提到“把这张图塞到文档里”“给文档挂个附件”“下载文档里的素材”
---

# 飞书文档媒体管理

## Standalone Wrapper

- 共享环境变量：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`，可选 `FEISHU_BASE_URL`、`FEISHU_OAUTH_STORE_DIR`
- `feishu_doc_media` -> `node scripts/doc-media.js '<json>'`

## 执行前必读

- 本 skill 只处理“新版文档 docx 的媒体块”和“文档素材下载”，不负责正文文本编辑
- `insert` 只接受本地文件路径，不支持 URL 图片；URL 图片应交给 `feishu-create-doc` 或 `feishu-update-doc`
- `doc_id` 支持直接传 `document_id`，也支持传 `/docx/...` 文档 URL
- 单个本地文件最大 20MB；图片支持对齐和标题，文件附件不支持这些显示参数

## 快速索引：意图 → 工具 → 必填参数

| 用户意图 | 工具 | 必填参数 | 常用可选 |
|---------|------|---------|---------|
| 向文档插入图片 | `feishu_doc_media` | `action="insert"`, `doc_id`, `file_path` | `type="image"`, `align`, `caption` |
| 向文档插入文件附件 | `feishu_doc_media` | `action="insert"`, `doc_id`, `file_path`, `type="file"` | - |
| 下载文档素材 | `feishu_doc_media` | `action="download"`, `resource_token`, `resource_type`, `output_path` | - |

## 核心约束（Schema 未透露的知识）

### 1. `insert` 是 3 步流程，不是单 API

底层实际顺序是：

1. 在 docx 文档末尾创建空块
2. 把本地文件上传为文档素材
3. 回写 block，把 `file_token` 绑定到块上

因此插入失败时，通常要分别排查文档 ID、本地文件、上传素材、块更新这几层。

### 2. 只支持本地文件，不支持远程 URL

- 本 skill 设计目标是“把本机已有文件塞进 docx”
- 如果用户给的是图片 URL，而不是本地路径，应改用文档内容类 skill
- 不要把这个 skill 写成“任意图片导入器”

### 3. 图片和文件附件的块类型不同

| 类型 | 默认值 | 可选参数 |
|------|-------|---------|
| `image` | 默认类型 | `align`, `caption` |
| `file` | 需显式指定 | 无图片对齐和标题能力 |

图片插入时工具会尝试自动探测尺寸；探测不到时仍会继续插入。

### 4. 下载支持两类资源

| `resource_type` | 含义 |
|----------------|------|
| `media` | 文档素材，如图片、视频、文件附件 |
| `whiteboard` | 画板缩略图 |

`output_path` 可以不带扩展名；工具会根据返回的 `Content-Type` 补后缀。

## 使用场景示例

### 场景 1：向 docx 插入图片

```json
{
  "action": "insert",
  "doc_id": "https://example.feishu.cn/docx/ABCD1234",
  "file_path": "/tmp/diagram.png",
  "type": "image",
  "align": "center",
  "caption": "架构示意图"
}
```

### 场景 2：向 docx 插入文件附件

```json
{
  "action": "insert",
  "doc_id": "dox_xxx",
  "file_path": "/tmp/spec.pdf",
  "type": "file"
}
```

### 场景 3：下载文档素材

```json
{
  "action": "download",
  "resource_token": "file_xxx",
  "resource_type": "media",
  "output_path": "/tmp/doc-media"
}
```

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| URL 图片插不进去 | `insert` 只接受本地文件 | 先把文件落到本地，或改用 `feishu-update-doc` |
| 文档 ID 识别失败 | 传的是旧版文档链接或无效 URL | 确认是 `/docx/` 链接，或直接传 `document_id` |
| 文件超过限制 | 单文件大于 20MB | 先压缩，或改走云空间上传再在文档中引用 |
| 图片对齐参数没生效 | 实际传的是 `type="file"` | 只有 `image` 类型支持 `align` 和 `caption` |
| 下载到的文件没有扩展名 | `output_path` 没带后缀 | 允许这样传，工具会按返回类型补全 |

## 官方文档参考

- 新版文档开放能力访问指南: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/docs/upgraded-docs-access-guide/upgraded-docs-openapi-access-guide`
- 在文档中创建块: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/document-docx/docx-v1/document-block-children/create`
- 上传素材: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/media/upload_all`
- 批量更新文档块: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/document-docx/docx-v1/document-block/batch_update`
- 下载素材: `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/media/download`

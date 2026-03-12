import os from "node:os";
import path from "node:path";
import { readFile, mkdir, stat, writeFile } from "node:fs/promises";

import { readEnvConfig } from "../core/config.js";
import { requestBinary, requestJson } from "../core/http.js";
import { callWithUserAccess } from "../auth/user.js";

const CHUNK_SIZE = 4 * 1024 * 1024;
const SMALL_FILE_THRESHOLD = 15 * 1024 * 1024;
const DOC_MEDIA_MAX_FILE_SIZE = 20 * 1024 * 1024;
const MIME_TO_EXT = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
  "image/tiff": ".tiff",
  "video/mp4": ".mp4",
  "video/mpeg": ".mpeg",
  "video/quicktime": ".mov",
  "video/x-msvideo": ".avi",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/zip": ".zip",
  "application/x-rar-compressed": ".rar",
  "text/plain": ".txt",
  "application/json": ".json"
};
const DOC_MEDIA_ALIGN_MAP = {
  left: 1,
  center: 2,
  right: 3
};
const DOC_MEDIA_CONFIG = {
  image: {
    block_type: 27,
    block_data: { image: {} },
    parent_type: "docx_image"
  },
  file: {
    block_type: 23,
    block_data: { file: { token: "" } },
    parent_type: "docx_file"
  }
};

function withUser(config, toolAction, callback) {
  return callWithUserAccess(config, toolAction, callback);
}

function makeTempPath(prefix, extension) {
  return path.join(
    os.tmpdir(),
    "feishu-codex-skills",
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension || ""}`
  );
}

function ensureOutputPath(outputPath, contentType, fallbackExt) {
  if (!outputPath) {
    return outputPath;
  }
  if (path.extname(outputPath)) {
    return outputPath;
  }
  const mimeType = contentType?.split(";")[0]?.trim();
  const ext = MIME_TO_EXT[mimeType] || fallbackExt || "";
  return `${outputPath}${ext}`;
}

async function loadUploadInput(params) {
  if (params.file_path) {
    const buffer = await readFile(params.file_path);
    return {
      buffer,
      fileName: params.file_name || path.basename(params.file_path),
      size: params.size || buffer.length
    };
  }

  if (params.file_content_base64) {
    if (!params.file_name || !params.size) {
      throw new Error("使用 file_content_base64 时，必须提供 file_name 和 size 参数");
    }
    return {
      buffer: Buffer.from(params.file_content_base64, "base64"),
      fileName: params.file_name,
      size: params.size
    };
  }

  throw new Error("必须提供 file_path 或 file_content_base64 参数之一");
}

async function resolveWikiNode(config, accessToken, token) {
  const response = await requestJson({
    baseUrl: config.baseUrl,
    path: "/open-apis/wiki/v2/spaces/get_node",
    accessToken,
    query: {
      token,
      obj_type: "wiki"
    }
  });
  return response.data?.node;
}

function convertCommentElements(elements) {
  return elements.map((item) => {
    if (item.type === "mention") {
      return {
        type: "person",
        person: {
          user_id: item.open_id
        }
      };
    }
    if (item.type === "link") {
      return {
        type: "docs_link",
        docs_link: {
          url: item.url
        }
      };
    }
    return {
      type: "text_run",
      text_run: {
        text: item.text || ""
      }
    };
  });
}

async function listCommentReplies(config, accessToken, fileToken, fileType, commentId, userIdType) {
  const replies = [];
  let pageToken;
  let hasMore = true;

  while (hasMore) {
    const response = await requestJson({
      baseUrl: config.baseUrl,
      path: `/open-apis/drive/v1/files/${fileToken}/comments/${commentId}/replies`,
      accessToken,
      query: {
        file_type: fileType,
        user_id_type: userIdType,
        page_size: 50,
        page_token: pageToken
      }
    });

    replies.push(...(response.data?.items || []));
    hasMore = response.data?.has_more || false;
    pageToken = response.data?.page_token;
  }

  return replies;
}

async function runDriveFile(config, params) {
  switch (params.action) {
    case "list":
      return withUser(config, "feishu_drive_file.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/drive/v1/files",
          accessToken,
          query: {
            folder_token: params.folder_token,
            page_size: params.page_size,
            page_token: params.page_token,
            order_by: params.order_by,
            direction: params.direction
          }
        });
        return {
          files: response.data?.files || [],
          has_more: response.data?.has_more || false,
          page_token: response.data?.next_page_token
        };
      });
    case "get_meta":
      return withUser(config, "feishu_drive_file.get_meta", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/drive/v1/metas/batch_query",
          method: "POST",
          accessToken,
          body: {
            request_docs: params.request_docs
          }
        });
        return {
          metas: response.data?.metas || []
        };
      });
    case "copy":
      return withUser(config, "feishu_drive_file.copy", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/drive/v1/files/${params.file_token}/copy`,
          method: "POST",
          accessToken,
          body: {
            name: params.name,
            type: params.type,
            folder_token: params.folder_token || params.parent_node
          }
        });
        return {
          file: response.data?.file
        };
      });
    case "move":
      return withUser(config, "feishu_drive_file.move", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/drive/v1/files/${params.file_token}/move`,
          method: "POST",
          accessToken,
          body: {
            type: params.type,
            folder_token: params.folder_token
          }
        });
        return {
          success: true,
          task_id: response.data?.task_id,
          file_token: params.file_token,
          target_folder_token: params.folder_token
        };
      });
    case "delete":
      return withUser(config, "feishu_drive_file.delete", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/drive/v1/files/${params.file_token}`,
          method: "DELETE",
          accessToken,
          query: {
            type: params.type
          }
        });
        return {
          success: true,
          task_id: response.data?.task_id,
          file_token: params.file_token
        };
      });
    case "upload":
      return withUser(config, "feishu_drive_file.upload", async (accessToken) => {
        const { buffer, fileName, size } = await loadUploadInput(params);
        if (size <= SMALL_FILE_THRESHOLD) {
          const form = new FormData();
          form.set("file_name", fileName);
          form.set("parent_type", "explorer");
          form.set("parent_node", params.parent_node || "");
          form.set("size", String(size));
          form.set("file", new Blob([buffer]), fileName);
          const response = await requestJson({
            baseUrl: config.baseUrl,
            path: "/open-apis/drive/v1/files/upload_all",
            method: "POST",
            accessToken,
            body: form
          });
          return {
            file_token: response.data?.file_token,
            file_name: fileName,
            size
          };
        }

        const prepare = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/drive/v1/files/upload_prepare",
          method: "POST",
          accessToken,
          body: {
            file_name: fileName,
            parent_type: "explorer",
            parent_node: params.parent_node || "",
            size
          }
        });
        const uploadId = prepare.data?.upload_id;
        const blockSize = prepare.data?.block_size || CHUNK_SIZE;
        const blockNum = prepare.data?.block_num || Math.ceil(size / blockSize);

        for (let seq = 0; seq < blockNum; seq += 1) {
          const start = seq * blockSize;
          const end = Math.min(start + blockSize, size);
          const chunkBuffer = buffer.subarray(start, end);
          const form = new FormData();
          form.set("upload_id", String(uploadId));
          form.set("seq", String(seq));
          form.set("size", String(chunkBuffer.length));
          form.set("file", new Blob([chunkBuffer]), `${fileName}.part${seq}`);
          await requestJson({
            baseUrl: config.baseUrl,
            path: "/open-apis/drive/v1/files/upload_part",
            method: "POST",
            accessToken,
            body: form
          });
        }

        const finish = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/drive/v1/files/upload_finish",
          method: "POST",
          accessToken,
          body: {
            upload_id: uploadId,
            block_num: blockNum
          }
        });
        return {
          file_token: finish.data?.file_token,
          file_name: fileName,
          size,
          upload_method: "chunked",
          chunks_uploaded: blockNum
        };
      });
    case "download":
      return withUser(config, "feishu_drive_file.download", async (accessToken) => {
        const response = await requestBinary({
          baseUrl: config.baseUrl,
          path: `/open-apis/drive/v1/files/${params.file_token}/download`,
          accessToken
        });

        if (!params.output_path) {
          return {
            file_content_base64: response.buffer.toString("base64"),
            size: response.buffer.length
          };
        }

        await mkdir(path.dirname(params.output_path), { recursive: true });
        await writeFile(params.output_path, response.buffer);
        return {
          saved_path: params.output_path,
          size: response.buffer.length
        };
      });
    default:
      throw new Error(`Unsupported drive file action: ${params.action}`);
  }
}

async function runDocMedia(config, params) {
  switch (params.action) {
    case "download":
      return withUser(config, "feishu_doc_media.download", async (accessToken) => {
        const response = params.resource_type === "media"
          ? await requestBinary({
            baseUrl: config.baseUrl,
            path: `/open-apis/drive/v1/medias/${params.resource_token}/download`,
            accessToken
          })
          : await requestBinary({
            baseUrl: config.baseUrl,
            path: `/open-apis/board/v1/whiteboards/${params.resource_token}/download_as_image`,
            accessToken
          });
        const finalPath = ensureOutputPath(
          params.output_path,
          response.headers["content-type"],
          params.resource_type === "whiteboard" ? ".png" : undefined
        );
        await mkdir(path.dirname(finalPath), { recursive: true });
        await writeFile(finalPath, response.buffer);
        return {
          resource_type: params.resource_type,
          resource_token: params.resource_token,
          size_bytes: response.buffer.length,
          content_type: response.headers["content-type"],
          saved_path: finalPath
        };
      });
    case "insert":
      return withUser(config, "feishu_doc_media.insert", async (accessToken) => {
        const info = await stat(params.file_path);
        if (info.size > DOC_MEDIA_MAX_FILE_SIZE) {
          throw new Error(`文件 ${(info.size / 1024 / 1024).toFixed(1)}MB 超过 20MB 限制`);
        }

        const documentId = String(params.doc_id).trim().match(/\/docx\/([A-Za-z0-9]+)/)?.[1] || String(params.doc_id).trim();
        const mediaType = params.type || "image";
        const mediaConfig = DOC_MEDIA_CONFIG[mediaType];
        const fileBuffer = await readFile(params.file_path);
        const fileName = path.basename(params.file_path);

        const created = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/docx/v1/documents/${documentId}/blocks/${documentId}/children`,
          method: "POST",
          accessToken,
          query: {
            document_revision_id: -1
          },
          body: {
            children: [
              {
                block_type: mediaConfig.block_type,
                ...mediaConfig.block_data
              }
            ]
          }
        });

        const blockId = mediaType === "file"
          ? created.data?.children?.[0]?.children?.[0]
          : created.data?.children?.[0]?.block_id;
        if (!blockId) {
          throw new Error(`创建 ${mediaType} block 失败：未返回 block_id`);
        }

        const form = new FormData();
        form.set("file_name", fileName);
        form.set("parent_type", mediaConfig.parent_type);
        form.set("parent_node", blockId);
        form.set("size", String(fileBuffer.length));
        form.set("file", new Blob([fileBuffer]), fileName);
        form.set("extra", JSON.stringify({ drive_route_token: documentId }));
        const upload = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/drive/v1/medias/upload_all",
          method: "POST",
          accessToken,
          body: form
        });
        const fileToken = upload.data?.file_token || upload.raw?.file_token;
        if (!fileToken) {
          throw new Error("上传文档媒体失败：未返回 file_token");
        }

        const replaceRequest = {
          block_id: blockId
        };
        if (mediaType === "image") {
          replaceRequest.replace_image = {
            token: fileToken,
            align: DOC_MEDIA_ALIGN_MAP[params.align || "center"],
            ...(params.caption ? { caption: { content: params.caption } } : {})
          };
        } else {
          replaceRequest.replace_file = {
            token: fileToken
          };
        }

        await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/docx/v1/documents/${documentId}/blocks/batch_update`,
          method: "PATCH",
          accessToken,
          query: {
            document_revision_id: -1
          },
          body: {
            requests: [replaceRequest]
          }
        });

        return {
          success: true,
          type: mediaType,
          document_id: documentId,
          block_id: blockId,
          file_token: fileToken,
          file_name: fileName
        };
      });
    default:
      throw new Error(`Unsupported doc media action: ${params.action}`);
  }
}

async function runDocComments(config, params) {
  switch (params.action) {
    case "list":
      return withUser(config, "feishu_doc_comments.list", async (accessToken) => {
        let fileToken = params.file_token;
        let fileType = params.file_type;
        if (fileType === "wiki") {
          const node = await resolveWikiNode(config, accessToken, fileToken);
          if (!node?.obj_token || !node?.obj_type) {
            throw new Error(`无法解析 wiki token "${params.file_token}" 到实际文档对象`);
          }
          fileToken = node.obj_token;
          fileType = node.obj_type;
        }

        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/drive/v1/files/${fileToken}/comments`,
          accessToken,
          query: {
            file_type: fileType,
            is_whole: params.is_whole,
            is_solved: params.is_solved,
            page_size: params.page_size || 50,
            page_token: params.page_token,
            user_id_type: params.user_id_type || "open_id"
          }
        });

        const items = response.data?.items || [];
        const assembled = await Promise.all(items.map(async (item) => {
          if (!item.reply_list?.replies?.length && !item.has_more) {
            return item;
          }
          const replies = await listCommentReplies(
            config,
            accessToken,
            fileToken,
            fileType,
            item.comment_id,
            params.user_id_type || "open_id"
          );
          return {
            ...item,
            reply_list: {
              replies
            }
          };
        }));

        return {
          items: assembled,
          has_more: response.data?.has_more || false,
          page_token: response.data?.page_token
        };
      });
    case "create":
      return withUser(config, "feishu_doc_comments.create", async (accessToken) => {
        let fileToken = params.file_token;
        let fileType = params.file_type;
        if (fileType === "wiki") {
          const node = await resolveWikiNode(config, accessToken, fileToken);
          if (!node?.obj_token || !node?.obj_type) {
            throw new Error(`无法解析 wiki token "${params.file_token}" 到实际文档对象`);
          }
          fileToken = node.obj_token;
          fileType = node.obj_type;
        }

        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/drive/v1/files/${fileToken}/comments`,
          method: "POST",
          accessToken,
          query: {
            file_type: fileType,
            user_id_type: params.user_id_type || "open_id"
          },
          body: {
            reply_list: {
              replies: [
                {
                  content: {
                    elements: convertCommentElements(params.elements || [])
                  }
                }
              ]
            }
          }
        });
        return response.data;
      });
    case "patch":
      return withUser(config, "feishu_doc_comments.patch", async (accessToken) => {
        let fileToken = params.file_token;
        let fileType = params.file_type;
        if (fileType === "wiki") {
          const node = await resolveWikiNode(config, accessToken, fileToken);
          if (!node?.obj_token || !node?.obj_type) {
            throw new Error(`无法解析 wiki token "${params.file_token}" 到实际文档对象`);
          }
          fileToken = node.obj_token;
          fileType = node.obj_type;
        }

        await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/drive/v1/files/${fileToken}/comments/${params.comment_id}`,
          method: "PATCH",
          accessToken,
          query: {
            file_type: fileType
          },
          body: {
            is_solved: params.is_solved_value
          }
        });
        return {
          success: true
        };
      });
    default:
      throw new Error(`Unsupported doc comments action: ${params.action}`);
  }
}

export async function runDrive(resource, params, env = process.env) {
  const config = readEnvConfig(env);
  switch (resource) {
    case "file":
      return runDriveFile(config, params);
    case "doc-media":
      return runDocMedia(config, params);
    case "doc-comments":
      return runDocComments(config, params);
    default:
      throw new Error(`Unsupported drive resource: ${resource}`);
  }
}

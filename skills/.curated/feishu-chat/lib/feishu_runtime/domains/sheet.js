import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { readEnvConfig } from "../core/config.js";
import { requestBinary, requestJson } from "../core/http.js";
import { callWithUserAccess } from "../auth/user.js";

const MAX_READ_ROWS = 200;
const MAX_WRITE_ROWS = 5000;
const MAX_WRITE_COLS = 100;
const EXPORT_POLL_INTERVAL_MS = 1000;
const EXPORT_POLL_MAX_RETRIES = 30;
const KNOWN_TOKEN_TYPES = new Set([
  "dox", "doc", "sht", "bas", "app", "sld", "bmn", "fld",
  "nod", "box", "jsn", "img", "isv", "wik", "wia", "wib",
  "wic", "wid", "wie", "dsb"
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSheetUrl(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/(?:sheets|wiki)\/([^/?#]+)/);
    if (!match) {
      return null;
    }
    return {
      token: match[1],
      sheetId: parsed.searchParams.get("sheet") || undefined
    };
  } catch {
    return null;
  }
}

function getTokenType(token) {
  if (token.length >= 15) {
    const prefix = token[4] + token[9] + token[14];
    if (KNOWN_TOKEN_TYPES.has(prefix)) {
      return prefix;
    }
  }
  if (token.length >= 3) {
    const prefix = token.slice(0, 3);
    if (KNOWN_TOKEN_TYPES.has(prefix)) {
      return prefix;
    }
  }
  return null;
}

function colLetter(column) {
  let value = column;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function flattenCellValue(cell) {
  if (!Array.isArray(cell)) {
    return cell;
  }
  if (cell.length > 0 && cell.every((segment) => segment && typeof segment === "object" && "text" in segment)) {
    return cell.map((segment) => segment.text).join("");
  }
  return cell;
}

function flattenValues(values) {
  return values?.map((row) => row.map(flattenCellValue));
}

function truncateRows(values, maxRows) {
  if (!values) {
    return {
      values,
      truncated: false,
      total_rows: 0
    };
  }
  if (values.length <= maxRows) {
    return {
      values,
      truncated: false,
      total_rows: values.length
    };
  }
  return {
    values: values.slice(0, maxRows),
    truncated: true,
    total_rows: values.length
  };
}

function withUser(config, toolAction, callback) {
  return callWithUserAccess(config, toolAction, callback);
}

async function resolveToken(config, accessToken, params) {
  let token;
  let urlSheetId;
  if (params.spreadsheet_token) {
    token = params.spreadsheet_token;
  } else if (params.url) {
    const parsed = parseSheetUrl(params.url);
    if (!parsed) {
      throw new Error(`无法从 URL 解析出 spreadsheet_token: ${params.url}`);
    }
    token = parsed.token;
    urlSheetId = parsed.sheetId;
  } else {
    throw new Error("必须提供 url 或 spreadsheet_token");
  }

  if (getTokenType(token) === "wik") {
    const response = await requestJson({
      baseUrl: config.baseUrl,
      path: "/open-apis/wiki/v2/spaces/get_node",
      accessToken,
      query: {
        token,
        obj_type: "wiki"
      }
    });
    const objToken = response.data?.node?.obj_token;
    if (!objToken) {
      throw new Error(`无法从 wiki token 解析出电子表格 token: ${token}`);
    }
    token = objToken;
  }

  return { token, urlSheetId };
}

async function getSpreadsheetInfo(config, accessToken, token) {
  const [spreadsheetResponse, sheetsResponse] = await Promise.all([
    requestJson({
      baseUrl: config.baseUrl,
      path: `/open-apis/sheets/v3/spreadsheets/${token}`,
      accessToken
    }),
    requestJson({
      baseUrl: config.baseUrl,
      path: `/open-apis/sheets/v3/spreadsheets/${token}/sheets/query`,
      accessToken
    })
  ]);

  return {
    spreadsheet: spreadsheetResponse.data?.spreadsheet,
    sheets: sheetsResponse.data?.sheets || []
  };
}

async function getDefaultSheetId(config, accessToken, token) {
  const response = await requestJson({
    baseUrl: config.baseUrl,
    path: `/open-apis/sheets/v3/spreadsheets/${token}/sheets/query`,
    accessToken
  });
  const firstSheet = response.data?.sheets?.[0];
  if (!firstSheet?.sheet_id) {
    throw new Error("电子表格中没有工作表");
  }
  return firstSheet.sheet_id;
}

export async function runSheet(params, env = process.env) {
  const config = readEnvConfig(env);
  switch (params.action) {
    case "info":
      return withUser(config, "feishu_sheet.info", async (accessToken) => {
        const { token } = await resolveToken(config, accessToken, params);
        const { spreadsheet, sheets } = await getSpreadsheetInfo(config, accessToken, token);
        return {
          title: spreadsheet?.title,
          spreadsheet_token: token,
          url: `https://bytedance.larkoffice.com/sheets/${token}`,
          sheets: sheets.map((sheet) => ({
            sheet_id: sheet.sheet_id,
            title: sheet.title,
            index: sheet.index,
            row_count: sheet.grid_properties?.row_count,
            column_count: sheet.grid_properties?.column_count,
            frozen_row_count: sheet.grid_properties?.frozen_row_count,
            frozen_column_count: sheet.grid_properties?.frozen_column_count
          }))
        };
      });
    case "read":
      return withUser(config, "feishu_sheet.read", async (accessToken) => {
        const { token, urlSheetId } = await resolveToken(config, accessToken, params);
        let range = params.range;
        if (!range) {
          range = params.sheet_id || urlSheetId || await getDefaultSheetId(config, accessToken, token);
        }
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/sheets/v2/spreadsheets/${token}/values/${encodeURIComponent(range)}`,
          accessToken,
          query: {
            valueRenderOption: params.value_render_option ?? "ToString",
            dateTimeRenderOption: "FormattedString"
          }
        });
        const valueRange = response.data?.valueRange;
        const { values, truncated, total_rows } = truncateRows(flattenValues(valueRange?.values), MAX_READ_ROWS);
        return {
          range: valueRange?.range,
          values,
          ...(truncated
            ? {
              truncated: true,
              total_rows,
              hint: `数据超过 ${MAX_READ_ROWS} 行，已截断。请缩小 range 重新读取。`
            }
            : {})
        };
      });
    case "write":
      return withUser(config, "feishu_sheet.write", async (accessToken) => {
        const { token, urlSheetId } = await resolveToken(config, accessToken, params);
        if (params.values?.length > MAX_WRITE_ROWS) {
          throw new Error(`写入行数 ${params.values.length} 超过限制 ${MAX_WRITE_ROWS}`);
        }
        if (params.values?.some((row) => Array.isArray(row) && row.length > MAX_WRITE_COLS)) {
          throw new Error(`写入列数超过限制 ${MAX_WRITE_COLS}`);
        }
        let range = params.range;
        if (!range) {
          range = params.sheet_id || urlSheetId || await getDefaultSheetId(config, accessToken, token);
        }
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/sheets/v2/spreadsheets/${token}/values`,
          method: "PUT",
          accessToken,
          body: {
            valueRange: {
              range,
              values: params.values
            }
          }
        });
        return {
          updated_range: response.data?.updatedRange,
          updated_rows: response.data?.updatedRows,
          updated_columns: response.data?.updatedColumns,
          updated_cells: response.data?.updatedCells,
          revision: response.data?.revision
        };
      });
    case "append":
      return withUser(config, "feishu_sheet.append", async (accessToken) => {
        const { token, urlSheetId } = await resolveToken(config, accessToken, params);
        if (params.values?.length > MAX_WRITE_ROWS) {
          throw new Error(`追加行数 ${params.values.length} 超过限制 ${MAX_WRITE_ROWS}`);
        }
        let range = params.range;
        if (!range) {
          range = params.sheet_id || urlSheetId || await getDefaultSheetId(config, accessToken, token);
        }
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/sheets/v2/spreadsheets/${token}/values_append`,
          method: "POST",
          accessToken,
          body: {
            valueRange: {
              range,
              values: params.values
            }
          }
        });
        const updates = response.data?.updates || {};
        return {
          table_range: response.data?.tableRange,
          updated_range: updates.updatedRange,
          updated_rows: updates.updatedRows,
          updated_columns: updates.updatedColumns,
          updated_cells: updates.updatedCells,
          revision: updates.revision
        };
      });
    case "find":
      return withUser(config, "feishu_sheet.find", async (accessToken) => {
        const { token } = await resolveToken(config, accessToken, params);
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/sheets/v3/spreadsheets/${token}/sheets/${params.sheet_id}/find`,
          method: "POST",
          accessToken,
          body: {
            find_condition: {
              range: params.range ? `${params.sheet_id}!${params.range}` : params.sheet_id,
              ...(params.match_case !== undefined ? { match_case: !params.match_case } : {}),
              ...(params.match_entire_cell !== undefined ? { match_entire_cell: params.match_entire_cell } : {}),
              ...(params.search_by_regex !== undefined ? { search_by_regex: params.search_by_regex } : {}),
              ...(params.include_formulas !== undefined ? { include_formulas: params.include_formulas } : {})
            },
            find: params.find
          }
        });
        const findResult = response.data?.find_result;
        return {
          matched_cells: findResult?.matched_cells,
          matched_formula_cells: findResult?.matched_formula_cells,
          rows_count: findResult?.rows_count
        };
      });
    case "create":
      return withUser(config, "feishu_sheet.create", async (accessToken) => {
        const created = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/sheets/v3/spreadsheets",
          method: "POST",
          accessToken,
          body: {
            title: params.title,
            folder_token: params.folder_token
          }
        });
        const token = created.data?.spreadsheet?.spreadsheet_token;
        if (!token) {
          throw new Error("创建表格失败：未获取到 token");
        }
        const url = `https://bytedance.larkoffice.com/sheets/${token}`;
        if (params.headers || params.data) {
          const rows = [];
          if (params.headers) {
            rows.push(params.headers);
          }
          if (params.data) {
            rows.push(...params.data);
          }
          if (rows.length > 0) {
            const sheetId = await getDefaultSheetId(config, accessToken, token);
            const numCols = Math.max(...rows.map((row) => row.length), 1);
            const range = `${sheetId}!A1:${colLetter(numCols)}${rows.length}`;
            try {
              await requestJson({
                baseUrl: config.baseUrl,
                path: `/open-apis/sheets/v2/spreadsheets/${token}/values`,
                method: "PUT",
                accessToken,
                body: {
                  valueRange: {
                    range,
                    values: rows
                  }
                }
              });
            } catch (error) {
              return {
                spreadsheet_token: token,
                url,
                warning: `表格已创建，但写入初始数据失败：${error.message}`
              };
            }
          }
        }
        return {
          spreadsheet_token: token,
          title: params.title,
          url
        };
      });
    case "export":
      return withUser(config, "feishu_sheet.export", async (accessToken) => {
        const { token } = await resolveToken(config, accessToken, params);
        if (params.file_extension === "csv" && !params.sheet_id) {
          throw new Error("导出 CSV 必须指定 sheet_id（CSV 一次只能导出一个工作表）");
        }
        const created = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/drive/v1/export_tasks",
          method: "POST",
          accessToken,
          body: {
            file_extension: params.file_extension,
            token,
            type: "sheet",
            sub_id: params.sheet_id
          }
        });
        const ticket = created.data?.ticket;
        if (!ticket) {
          throw new Error("导出任务创建失败：未获取到 ticket");
        }

        let fileToken;
        let fileName;
        let fileSize;
        for (let i = 0; i < EXPORT_POLL_MAX_RETRIES; i += 1) {
          await sleep(EXPORT_POLL_INTERVAL_MS);
          const poll = await requestJson({
            baseUrl: config.baseUrl,
            path: `/open-apis/drive/v1/export_tasks/${ticket}`,
            accessToken,
            query: {
              token
            }
          });
          const result = poll.data?.result;
          const jobStatus = result?.job_status;
          if (jobStatus === 0) {
            fileToken = result.file_token;
            fileName = result.file_name;
            fileSize = result.file_size;
            break;
          }
          if (jobStatus !== undefined && jobStatus >= 3) {
            throw new Error(result?.job_error_msg || `导出失败 (status=${jobStatus})`);
          }
        }

        if (!fileToken) {
          throw new Error("导出超时：任务未在 30 秒内完成");
        }

        if (!params.output_path) {
          return {
            file_token: fileToken,
            file_name: fileName,
            file_size: fileSize,
            hint: "文件已导出。提供 output_path 参数可下载到本地。"
          };
        }

        const download = await requestBinary({
          baseUrl: config.baseUrl,
          path: `/open-apis/drive/v1/export_tasks/file/${fileToken}/download`,
          accessToken
        });
        await mkdir(path.dirname(params.output_path), { recursive: true });
        await writeFile(params.output_path, download.buffer);
        return {
          file_path: params.output_path,
          file_name: fileName,
          file_size: fileSize
        };
      });
    default:
      throw new Error(`Unsupported sheet action: ${params.action}`);
  }
}

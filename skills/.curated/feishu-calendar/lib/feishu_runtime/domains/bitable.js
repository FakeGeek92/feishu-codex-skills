import { readEnvConfig } from "../core/config.js";
import { requestJson } from "../core/http.js";
import { callWithUserAccess } from "../auth/user.js";

function userRequest(config, toolAction, requestFactory) {
  return callWithUserAccess(config, toolAction, (accessToken) =>
    requestFactory(accessToken)
  );
}

function cleanFieldProperty(field) {
  if ((field.type === 7 || field.type === 15) && field.property !== undefined) {
    const { property, ...rest } = field;
    return rest;
  }
  return field;
}

function normalizeFilter(filter) {
  if (!filter?.conditions) {
    return filter;
  }

  return {
    ...filter,
    conditions: filter.conditions.map((condition) => {
      if (
        (condition.operator === "isEmpty" || condition.operator === "isNotEmpty") &&
        condition.value === undefined
      ) {
        return {
          ...condition,
          value: []
        };
      }
      return condition;
    })
  };
}

async function handleApp(config, params) {
  switch (params.action) {
    case "create":
      return userRequest(config, "feishu_bitable_app.create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/bitable/v1/apps",
          method: "POST",
          accessToken,
          body: {
            name: params.name,
            folder_token: params.folder_token
          }
        });
        return { app: response.data.app };
      });
    case "get":
      return userRequest(config, "feishu_bitable_app.get", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}`,
          accessToken
        });
        return { app: response.data.app };
      });
    case "list":
      return userRequest(config, "feishu_bitable_app.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/drive/v1/files",
          accessToken,
          query: {
            folder_token: params.folder_token,
            page_size: params.page_size,
            page_token: params.page_token
          }
        });
        const apps = (response.data.files || []).filter((item) => item.type === "bitable");
        return {
          apps,
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    case "patch":
      return userRequest(config, "feishu_bitable_app.patch", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}`,
          method: "PATCH",
          accessToken,
          body: {
            name: params.name,
            is_advanced: params.is_advanced
          }
        });
        return { app: response.data.app };
      });
    case "copy":
      return userRequest(config, "feishu_bitable_app.copy", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/copy`,
          method: "POST",
          accessToken,
          body: {
            name: params.name,
            folder_token: params.folder_token
          }
        });
        return { app: response.data.app };
      });
    default:
      throw new Error(`Unsupported bitable app action: ${params.action}`);
  }
}

async function handleTable(config, params) {
  switch (params.action) {
    case "create":
      return userRequest(config, "feishu_bitable_app_table.create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables`,
          method: "POST",
          accessToken,
          body: {
            table: {
              ...params.table,
              fields: params.table.fields?.map(cleanFieldProperty)
            }
          }
        });
        return {
          table_id: response.data.table_id,
          default_view_id: response.data.default_view_id,
          field_id_list: response.data.field_id_list
        };
      });
    case "list":
      return userRequest(config, "feishu_bitable_app_table.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables`,
          accessToken,
          query: {
            page_size: params.page_size,
            page_token: params.page_token
          }
        });
        return {
          tables: response.data.items,
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    case "patch":
      return userRequest(config, "feishu_bitable_app_table.patch", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}`,
          method: "PATCH",
          accessToken,
          body: {
            name: params.name
          }
        });
        return { name: response.data.name };
      });
    case "delete":
      return userRequest(config, "feishu_bitable_app_table.delete", async (accessToken) => {
        await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}`,
          method: "DELETE",
          accessToken
        });
        return { success: true };
      });
    case "batch_create":
      return userRequest(config, "feishu_bitable_app_table.batch_create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/batch_create`,
          method: "POST",
          accessToken,
          body: { tables: params.tables }
        });
        return { table_ids: response.data.table_ids };
      });
    case "batch_delete":
      return userRequest(config, "feishu_bitable_app_table.batch_delete", async (accessToken) => {
        await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/batch_delete`,
          method: "POST",
          accessToken,
          body: { table_ids: params.table_ids }
        });
        return { success: true };
      });
    default:
      throw new Error(`Unsupported bitable table action: ${params.action}`);
  }
}

async function listFields(config, accessToken, appToken, tableId) {
  const response = await requestJson({
    baseUrl: config.baseUrl,
    path: `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    accessToken,
    query: { page_size: 500 }
  });
  return response.data.items || [];
}

async function handleField(config, params) {
  switch (params.action) {
    case "create":
      return userRequest(config, "feishu_bitable_app_table_field.create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/fields`,
          method: "POST",
          accessToken,
          body: cleanFieldProperty({
            field_name: params.field_name,
            type: params.type,
            property: params.property
          })
        });
        return { field: response.data.field || response.data };
      });
    case "list":
      return userRequest(config, "feishu_bitable_app_table_field.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/fields`,
          accessToken,
          query: {
            view_id: params.view_id,
            page_size: params.page_size,
            page_token: params.page_token
          }
        });
        return {
          fields: response.data.items,
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    case "update":
      return userRequest(config, "feishu_bitable_app_table_field.update", async (accessToken) => {
        let currentField;
        if (!params.field_name || !params.type) {
          currentField = (await listFields(config, accessToken, params.app_token, params.table_id))
            .find((item) => item.field_id === params.field_id);
        }
        const payload = cleanFieldProperty({
          field_name: params.field_name || currentField?.field_name,
          type: params.type ?? currentField?.type,
          property: params.property !== undefined ? params.property : currentField?.property
        });
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/fields/${params.field_id}`,
          method: "PUT",
          accessToken,
          body: payload
        });
        return { field: response.data.field || response.data };
      });
    case "delete":
      return userRequest(config, "feishu_bitable_app_table_field.delete", async (accessToken) => {
        await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/fields/${params.field_id}`,
          method: "DELETE",
          accessToken
        });
        return { success: true };
      });
    default:
      throw new Error(`Unsupported bitable field action: ${params.action}`);
  }
}

async function handleRecord(config, params) {
  const basePath = `/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/records`;
  switch (params.action) {
    case "create":
      return userRequest(config, "feishu_bitable_app_table_record.create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: basePath,
          method: "POST",
          accessToken,
          query: { user_id_type: "open_id" },
          body: { fields: params.fields }
        });
        return { record: response.data.record };
      });
    case "update":
      return userRequest(config, "feishu_bitable_app_table_record.update", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `${basePath}/${params.record_id}`,
          method: "PUT",
          accessToken,
          query: { user_id_type: "open_id" },
          body: { fields: params.fields }
        });
        return { record: response.data.record };
      });
    case "delete":
      return userRequest(config, "feishu_bitable_app_table_record.delete", async (accessToken) => {
        await requestJson({
          baseUrl: config.baseUrl,
          path: `${basePath}/${params.record_id}`,
          method: "DELETE",
          accessToken
        });
        return { success: true };
      });
    case "batch_create":
      return userRequest(config, "feishu_bitable_app_table_record.batch_create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `${basePath}/batch_create`,
          method: "POST",
          accessToken,
          query: { user_id_type: "open_id" },
          body: { records: params.records }
        });
        return { records: response.data.records };
      });
    case "batch_update":
      return userRequest(config, "feishu_bitable_app_table_record.batch_update", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `${basePath}/batch_update`,
          method: "POST",
          accessToken,
          query: { user_id_type: "open_id" },
          body: { records: params.records }
        });
        return { records: response.data.records };
      });
    case "batch_delete":
      return userRequest(config, "feishu_bitable_app_table_record.batch_delete", async (accessToken) => {
        await requestJson({
          baseUrl: config.baseUrl,
          path: `${basePath}/batch_delete`,
          method: "POST",
          accessToken,
          body: { record_ids: params.record_ids }
        });
        return { success: true };
      });
    case "list":
      return userRequest(config, "feishu_bitable_app_table_record.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `${basePath}/search`,
          method: "POST",
          accessToken,
          query: { user_id_type: "open_id" },
          body: {
            view_id: params.view_id,
            field_names: params.field_names,
            filter: normalizeFilter(params.filter),
            sort: params.sort,
            automatic_fields: params.automatic_fields,
            page_size: params.page_size,
            page_token: params.page_token
          }
        });
        return {
          records: response.data.items,
          total: response.data.total,
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    default:
      throw new Error(`Unsupported bitable record action: ${params.action}`);
  }
}

async function handleView(config, params) {
  switch (params.action) {
    case "create":
      return userRequest(config, "feishu_bitable_app_table_view.create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/views`,
          method: "POST",
          accessToken,
          body: {
            view_name: params.view_name,
            view_type: params.view_type || "grid"
          }
        });
        return { view: response.data.view };
      });
    case "get":
      return userRequest(config, "feishu_bitable_app_table_view.get", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/views/${params.view_id}`,
          accessToken
        });
        return { view: response.data.view };
      });
    case "list":
      return userRequest(config, "feishu_bitable_app_table_view.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/views`,
          accessToken,
          query: {
            page_size: params.page_size,
            page_token: params.page_token
          }
        });
        return {
          views: response.data.items,
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    case "patch":
      return userRequest(config, "feishu_bitable_app_table_view.patch", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/views/${params.view_id}`,
          method: "PATCH",
          accessToken,
          body: { view_name: params.view_name }
        });
        return { view: response.data.view };
      });
    case "delete":
      return userRequest(config, "feishu_bitable_app_table_view.delete", async (accessToken) => {
        await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/views/${params.view_id}`,
          method: "DELETE",
          accessToken
        });
        return { success: true };
      });
    default:
      throw new Error(`Unsupported bitable view action: ${params.action}`);
  }
}

export async function runBitable(resource, params, env = process.env) {
  const config = readEnvConfig(env);
  switch (resource) {
    case "app":
      return handleApp(config, params);
    case "table":
      return handleTable(config, params);
    case "field":
      return handleField(config, params);
    case "record":
      return handleRecord(config, params);
    case "view":
      return handleView(config, params);
    default:
      throw new Error(`Unsupported bitable resource: ${resource}`);
  }
}

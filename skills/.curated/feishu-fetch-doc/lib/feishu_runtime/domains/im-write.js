import { readEnvConfig } from "../core/config.js";
import { requestJson } from "../core/http.js";
import { callWithUserAccess } from "../auth/user.js";

function withUser(config, toolAction, callback) {
  return callWithUserAccess(config, toolAction, callback);
}

export async function runImWrite(params, env = process.env) {
  const config = readEnvConfig(env);
  switch (params.action) {
    case "send":
      return withUser(config, "feishu_im_user_message.send", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/im/v1/messages",
          method: "POST",
          accessToken,
          query: {
            receive_id_type: params.receive_id_type
          },
          body: {
            receive_id: params.receive_id,
            msg_type: params.msg_type,
            content: params.content,
            uuid: params.uuid
          }
        });
        return {
          message_id: response.data?.message_id,
          chat_id: response.data?.chat_id,
          create_time: response.data?.create_time
        };
      });
    case "reply":
      return withUser(config, "feishu_im_user_message.reply", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/im/v1/messages/${params.message_id}/reply`,
          method: "POST",
          accessToken,
          body: {
            content: params.content,
            msg_type: params.msg_type,
            reply_in_thread: params.reply_in_thread,
            uuid: params.uuid
          }
        });
        return {
          message_id: response.data?.message_id,
          chat_id: response.data?.chat_id,
          create_time: response.data?.create_time
        };
      });
    default:
      throw new Error(`Unsupported IM write action: ${params.action}`);
  }
}

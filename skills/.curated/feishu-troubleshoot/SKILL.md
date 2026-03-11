---
name: feishu-troubleshoot
description: Use when diagnosing Feishu skill credentials, tenant auth, OAuth token status, or missing app scopes in Codex.
---

## Standalone Wrapper

- 这套 standalone 包沿用原插件的两层鉴权：先提供 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`，再在需要时完成用户授权
- 首次使用前必须先配置 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`；否则任何联网诊断都会直接返回 `missing_env`
- 共享环境变量：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`，可选 `FEISHU_BASE_URL`、`FEISHU_OAUTH_STORE_DIR`
- 用户授权会持久化到共享 token store；同一 `FEISHU_APP_ID` 下其他已安装 skill 会复用，不需要各自重复授权
- 执行命令：`node scripts/troubleshoot.js '{"action":"doctor"}'`
- 如需检查某个动作的 scope：`node scripts/troubleshoot.js '{"tool_action":"feishu_create_doc.default"}'`
- 如需一次预授权当前公开能力型 skills 的 scope 并写入共享 store：`node scripts/troubleshoot.js '{"action":"preauth_all"}'`
- 原文中的 `/feishu doctor`，在 standalone 场景里对应上面的脚本命令

下面开始是插件原始 skill 正文。


# 飞书插件问题排查

## ❓ 常见问题（FAQ）

### 卡片按钮点击无反应

**现象**：点击卡片按钮后没有任何反应，然后提示报错.

**原因**：应用未开通「消息卡片回传交互」权限。

**解决步骤**：

1. 登录飞书开放平台：https://open.feishu.cn/app
2. 选择您的应用 → **事件与回调**
3. 在回调配置中,修改订阅方式为"长链接"并添加回调 "卡片回传交互"(card.action.trigger)
4. 创建应用版本 → 提交审核 → 发布


## 🔍 诊断命令（深度工具）

**注意**：诊断命令仅用于排查复杂/疑难的**权限相关问题**。常规权限问题会自动触发授权流程，无需手动诊断。

**何时使用诊断**：
- 多次授权后仍然报错
- 自动授权流程无法解决的问题
- 需要查看完整的权限配置状态

**使用方法**：

在飞书聊天会话中直接输入（作为用户消息发送）：

/feishu doctor

诊断命令会检查：

- **📋 诊断摘要**（首先展示）：
  - 总体状态（✅ 正常 / ⚠️ 警告 / ❌ 失败）
  - 发现的问题列表和简要描述

- **环境信息**：
  - 插件版本

- **账号信息**：
  - 凭证完整性（appId, appSecret 掩码）
  - 账户启用状态
  - API 连通性测试
  - Bot 信息（名称和 openId）

- **应用身份权限**：
  - 应用已开通的必需权限数量
  - 缺失的必需权限列表
  - 一键申请链接（自动带上缺失权限参数）

- **用户身份权限**：
  - 用户授权状态统计（✓ 有效 / ⟳ 需刷新 / ✗ 已过期）
  - Token 自动刷新状态（是否包含 offline_access）
  - 权限对照表（应用已开通 vs 用户已授权，逐项对比）
  - 应用权限缺失时的申请指引和链接
  - 用户授权不足时的重新授权操作方法

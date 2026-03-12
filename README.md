# Feishu Codex Skills

基于官方 `feishu-openclaw-plugin` 移植的一组 Codex skills，用来把飞书常用能力直接接入 Codex。这个仓库遵循 `skill-creator` 的结构约束，目标是让用户直接通过官方 Skill Installer 从 GitHub 安装，不需要自己手工 `create` skill。

## 安装要求

开始前请确保：

- 已安装 Codex，并且可以使用官方 `skill-installer`
- 建议使用 Node.js `22` 或更高版本
- 已有一个飞书企业自建应用，或准备新建一个
- 应用已添加 Bot 能力，并为你要使用的能力开通相应权限

如果你主要面向国际版 Lark，可额外设置：

```bash
export FEISHU_BASE_URL=https://open.larksuite.com
```

## 安装方式
### 直接告诉 codex

用自然语言的方式告诉 codex 帮你安装

```text
帮我安装这组飞书的 skills
https://github.com/FakeGeek92/feishu-codex-skills
```

也可以只安装单个 skill：


```text
帮我安装飞书多维表格的 skill
https://github.com/FakeGeek92/feishu-codex-skills
```

如果你是升级已有 skill，可以直接明确说要覆盖旧版本：

```text
帮我从这个仓库升级这组飞书 skills；如果 ~/.codex/skills 下已有同名旧版本，请先删除旧目录再重新安装
https://github.com/FakeGeek92/feishu-codex-skills
```

把这个 GitHub 仓库路径给 Codex 后，Codex 可以通过官方 Skill Installer 执行 `install-skill-from-github.py --repo ... --path ...` 来安装；不是自动 `git clone`，而是按 skill 目录下载和安装。

注意：官方 Skill Installer 遇到 `~/.codex/skills/<skill-name>` 已存在时会直接报错，不会自动覆盖。因此“升级”这个仓库里的 skill，实际做法是先删除旧目录，再重新安装同名 skill。

### 列出可安装 skills

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/list-skills.py \
  --repo FakeGeek92/feishu-codex-skills \
  --path skills/.curated
```

### 安装单个 skill

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo FakeGeek92/feishu-codex-skills \
  --path skills/.curated/feishu-task
```

### 升级单个 skill（覆盖旧版本）

如果你本地改过这个 skill，请先自行备份；下面的命令会直接删除旧目录再重装：

```bash
rm -rf ~/.codex/skills/feishu-task && \
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo FakeGeek92/feishu-codex-skills \
  --path skills/.curated/feishu-task
```

### 一次安装全部 curated skill

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo FakeGeek92/feishu-codex-skills \
  --path \
  skills/.curated/feishu-bitable \
  skills/.curated/feishu-calendar \
  skills/.curated/feishu-chat \
  skills/.curated/feishu-create-doc \
  skills/.curated/feishu-doc-comments \
  skills/.curated/feishu-doc-media \
  skills/.curated/feishu-drive-file \
  skills/.curated/feishu-fetch-doc \
  skills/.curated/feishu-im-read \
  skills/.curated/feishu-im-write \
  skills/.curated/feishu-search-doc \
  skills/.curated/feishu-sheet \
  skills/.curated/feishu-task \
  skills/.curated/feishu-troubleshoot \
  skills/.curated/feishu-update-doc \
  skills/.curated/feishu-user \
  skills/.curated/feishu-wiki
```

### 升级全部 curated skill（覆盖旧版本）

如果你想从这个仓库整体升级到最新 curated 版本，可以直接覆盖安装：

```bash
rm -rf \
  ~/.codex/skills/feishu-bitable \
  ~/.codex/skills/feishu-calendar \
  ~/.codex/skills/feishu-chat \
  ~/.codex/skills/feishu-create-doc \
  ~/.codex/skills/feishu-doc-comments \
  ~/.codex/skills/feishu-doc-media \
  ~/.codex/skills/feishu-drive-file \
  ~/.codex/skills/feishu-fetch-doc \
  ~/.codex/skills/feishu-im-read \
  ~/.codex/skills/feishu-im-write \
  ~/.codex/skills/feishu-search-doc \
  ~/.codex/skills/feishu-sheet \
  ~/.codex/skills/feishu-task \
  ~/.codex/skills/feishu-troubleshoot \
  ~/.codex/skills/feishu-update-doc \
  ~/.codex/skills/feishu-user \
  ~/.codex/skills/feishu-wiki && \
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo FakeGeek92/feishu-codex-skills \
  --path \
  skills/.curated/feishu-bitable \
  skills/.curated/feishu-calendar \
  skills/.curated/feishu-chat \
  skills/.curated/feishu-create-doc \
  skills/.curated/feishu-doc-comments \
  skills/.curated/feishu-doc-media \
  skills/.curated/feishu-drive-file \
  skills/.curated/feishu-fetch-doc \
  skills/.curated/feishu-im-read \
  skills/.curated/feishu-im-write \
  skills/.curated/feishu-search-doc \
  skills/.curated/feishu-sheet \
  skills/.curated/feishu-task \
  skills/.curated/feishu-troubleshoot \
  skills/.curated/feishu-update-doc \
  skills/.curated/feishu-user \
  skills/.curated/feishu-wiki
```

安装完成后，重启 Codex 以加载新 skills。

如果 GitHub API 返回 `403`，请设置：

- `GITHUB_TOKEN`
- 或 `GH_TOKEN`

然后重新执行安装命令。

## 快速开始

### 1. 创建飞书应用并开通能力

参考原插件的安装流程，先在飞书开放平台创建企业自建应用，并完成以下准备：

1. 添加 Bot 能力
2. 为计划使用的能力开通对应 scopes
3. 获取应用的 `App ID` 和 `App Secret`

如果你不确定缺了哪些权限，建议先安装 `feishu-troubleshoot`，后续通过 `doctor` 或 `preauth_all` 按提示补齐。

### 2. 安装需要的 skills

如果你只是先打通文档链路，可以先装：

- `feishu-troubleshoot`
- `feishu-create-doc`
- `feishu-fetch-doc`
- `feishu-update-doc`

如果你想一次配齐，直接安装全部 curated skill。

### 3. 配置应用级凭证

这一步是必须的。对于 standalone Codex skills，推荐直接使用环境变量：

```bash
export FEISHU_APP_ID=cli_xxxxxxxxxxxxxx
export FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

这里使用环境变量，不是改了原插件的鉴权模型，而是把原插件里的 `appId` / `appSecret` 配置，落到了更适合 Codex skills 的运行方式上。

原插件本身也支持两种来源：

- `openclaw.json` 中的 `appId` / `appSecret`
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 环境变量

本仓库没有 `openclaw.json`，因此最佳实践就是直接设置环境变量。

### 4. 先运行诊断

推荐先用 `feishu-troubleshoot` 跑一次 `doctor`：

```bash
node ~/.codex/skills/feishu-troubleshoot/scripts/troubleshoot.js '{"action":"doctor"}'
```

这一步会帮助你确认：

- app 凭证是否已生效
- tenant auth 是否成功
- bot 信息是否可读取
- 当前是否还缺用户授权
- 应用是否缺失所需 scope

### 5. 首次完成用户授权

应用级凭证就绪后，第一次真正调用用户态能力时，会触发 Feishu OAuth Device Flow。

如果你想一次性把当前公开能力型 skills 需要的用户权限先授权好，可以显式执行：

```bash
node ~/.codex/skills/feishu-troubleshoot/scripts/troubleshoot.js '{"action":"preauth_all"}'
```

当前仓库的 `preauth_all` 会按 curated skill 能力面一次申请所需的用户 scope，其中也包括 `feishu-im-write` 使用的用户发消息权限。按照终端提示确认授权后，再去使用文档、任务、日历、多维表格、消息读取和消息发送等 skill。

## 鉴权模型

这套仓库沿用原插件的同一套最佳实践：**应用级凭证 + 用户级授权，两层都需要**。

### 第一层：应用级凭证

必填环境变量：

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`

可选环境变量：

- `FEISHU_BASE_URL`
- `FEISHU_OAUTH_STORE_DIR`

这一层对应原插件里的 `appId` / `appSecret`。原插件会先检查配置文件或环境变量中的 app 凭证，再创建 Lark/Feishu SDK client；本仓库做的是同一件事，只是把配置入口固定成了环境变量。

没有这一步，既无法完成 tenant 级 API 调用，也无法发起后续的 Device Flow 用户授权。

### 第二层：用户级授权

当 skill 需要 `user_access_token` 时，系统会在首次调用时触发 Feishu Device Flow。

这一步仍然依赖第一层的 `App ID` / `App Secret` 发起授权请求，所以它不是“只做 auth 就行”的替代方案，而是第二层补充。

### token 持久化与跨 skill 复用

默认共享 token store 路径：

```text
${CODEX_HOME:-~/.codex}/feishu-oauth/<appId>
```

这意味着：

- skill 可以独立安装
- 授权状态不独立
- 同一 `FEISHU_APP_ID` 下多个 skill 共享同一份 token
- 不需要每个 skill 各自重复授权

只有这些情况才可能再次要求授权：

- 换了 `FEISHU_APP_ID`
- 改了 `FEISHU_OAUTH_STORE_DIR`
- refresh token 失效
- 新 skill 需要此前未授权的新 scope

## 已包含的 Skills

| Skill | 作用 |
| --- | --- |
| `feishu-bitable` | 管理多维表格应用、数据表、字段、视图和记录 |
| `feishu-chat` | 搜索群聊、获取群详情、查询群成员 |
| `feishu-calendar` | 管理日历、日程、参会人和忙闲信息 |
| `feishu-create-doc` | 创建飞书云文档 |
| `feishu-doc-comments` | 管理云文档评论 |
| `feishu-doc-media` | 插入或下载文档媒体 |
| `feishu-drive-file` | 管理云空间文件 |
| `feishu-fetch-doc` | 获取飞书云文档内容 |
| `feishu-im-read` | 读取飞书消息、搜索消息、下载消息资源 |
| `feishu-im-write` | 以用户身份发送和回复飞书消息 |
| `feishu-search-doc` | 搜索飞书文档和知识库 |
| `feishu-sheet` | 创建、读写、查找和导出电子表格 |
| `feishu-task` | 管理飞书任务和任务清单 |
| `feishu-troubleshoot` | 诊断 app 凭证、tenant auth、用户授权和缺失 scope |
| `feishu-update-doc` | 更新飞书云文档内容 |
| `feishu-user` | 获取当前用户、按 ID 查询用户、搜索用户 |
| `feishu-wiki` | 管理知识空间和 Wiki 节点 |

## 能力概览

| 类别 | 能力 | 对应 skills |
| --- | --- | --- |
| 消息 | 读取群聊/私聊历史、话题回复、消息搜索、图片和文件下载、以用户身份发消息 | `feishu-im-read` `feishu-im-write` |
| 用户与群聊 | 获取用户、搜索用户、搜索群聊、查看群成员 | `feishu-user` `feishu-chat` |
| 云文档 | 创建云文档、读取云文档内容、更新云文档、评论、媒体插入/下载 | `feishu-create-doc` `feishu-fetch-doc` `feishu-update-doc` `feishu-doc-comments` `feishu-doc-media` |
| 多维表格 | 表格、数据表、字段、记录、视图管理 | `feishu-bitable` |
| 日历 | 日历管理、日程管理、参会人管理、忙闲查询 | `feishu-calendar` |
| 云空间与知识库 | 云空间文件管理、知识空间和节点管理 | `feishu-drive-file` `feishu-wiki` |
| 电子表格与搜索 | 电子表格读写导出、文档和知识库搜索 | `feishu-sheet` `feishu-search-doc` |
| 任务 | 任务、任务清单、成员与完成状态管理 | `feishu-task` |
| 诊断 | 检查 app 凭证、tenant auth、用户授权、缺失 scope | `feishu-troubleshoot` |

## 验证状态

截至 2026-03-12，这个仓库已经按 standalone 形态完成了全量验收：

- `17` 个 curated Feishu skill 全部纳入验证范围
- `node scripts/validate-all.mjs` 通过
- `npm test` 通过
- `RUN_FEISHU_LIVE=1 FEISHU_LIVE_STRICT=1 node --test tests/live.test.js` 通过，且 `0 skip`

strict live suite 会动态创建并尽量清理测试资源。对于像 Wiki space / node 这类当前能力面没有对称删除动作的资源，测试会把残留 ID 输出到日志中，便于人工回收。

## 与原插件的关系

这个仓库来自官方 Feishu OpenClaw 插件的独立移植版，但两者不是同一个产品形态：

- 原插件是 OpenClaw 的 channel/plugin，负责 Feishu 消息接入、网关运行、配对、群策略、交互卡片、流式回复等运行时能力。
- 本仓库是 Codex skills 仓库，目标是把飞书能力和原始 skill 说明迁移成可被 Codex 直接调用的 standalone skill。
- 本仓库复用了原插件的 skill 文案思路、Feishu API 调用模型和鉴权方式，但不复刻 OpenClaw 网关接入层。

这意味着本仓库不会包含这些原插件特有能力：

- OpenClaw gateway / channel 接入
- DM `pairing` 与群聊 allowlist 策略
- 交互卡片和流式回复
- 群级 skill 绑定、自定义 system prompt 等 channel 配置

## FAQ

### 安装后为什么还不能直接用？

因为安装 skill 只完成了“把能力装进 Codex”，还没有完成“把你的飞书应用和身份接进来”。

真正可用需要两步都完成：

1. 配置 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`
2. 在首次使用用户态能力时完成一次用户授权

### 为什么必须先配置 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`？

因为这就是原插件本身的基础接入方式。原插件里要先提供 `appId` / `appSecret`，才能建立应用身份、拿 tenant token、探测 bot 信息，并在后续发起 Device Flow。

本仓库没有 `openclaw.json`，所以把同样的凭证改成环境变量来提供。

### 为什么第一次还会要求我做用户授权？

因为很多飞书能力需要 `user_access_token` 才能调用，例如读取你有权限的消息、文档、任务、日历等。

应用级凭证解决的是“这是哪个飞书应用”，用户授权解决的是“以哪个用户身份调用这些 API”。

### 每个 skill 都要重新授权一次吗？

正常情况下不用。

所有 skill 默认共享同一个 token store：`${CODEX_HOME:-~/.codex}/feishu-oauth/<appId>`。只要 `FEISHU_APP_ID` 不变，完成一次授权后，其他已安装 skill 会复用同一份 token。

### 为什么这里没有原插件里的 pairing？

因为 `pairing` 属于 OpenClaw Feishu channel 的会话准入控制，解决的是“谁可以和 bot 建立对话”。

这个仓库是 standalone Codex skills，不负责 Feishu channel 接入，因此不需要把 `pairing` 放进安装和授权主流程。

### GitHub API 403 怎么办？

给当前环境设置以下任一变量后重试：

- `GITHUB_TOKEN`
- `GH_TOKEN`

## 说明

- 本仓库不会修改原插件源码，只做独立移植和运行时封装
- `SKILL.md` 正文尽量保持原插件内容，Codex 适配只放在 frontmatter 与顶部薄说明层
- 推荐把 `feishu-troubleshoot` 作为第一个安装、也是第一个运行的 skill

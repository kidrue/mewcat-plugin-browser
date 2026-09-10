# AGENTS.md — mewCat (译趣喵) 项目文档

> **维护规则**：每次对项目做出修改后，必须执行 `pnpm check` 进行全量检查，确认无报错后，再在本文件末尾的 [修改记录](#修改记录) 章节追加一条记录，格式见该章节说明。

> **格式规则**：所有代码修改必须符合 Prettier 格式规范。修改 `src/` 下的文件后，必须执行 `pnpm format` 确保格式一致。Codex 已配置 PostToolUse hook，会在每次文件写入/编辑后自动执行 `pnpm format`。

> **功能开发规则**：实现任何新功能前，必须按以下顺序完成分析，经用户确认后再动手编码：
>
> 1. **需求可行性分析** — 明确需求边界、约束条件（MV3 限制、CSP、跨域等），判断是否可行及潜在风险
> 2. **技术选型** — 列出可选方案及各自的优缺点，给出推荐选项和理由
> 3. **技术落地方案** — 描述具体实现路径：涉及哪些文件、新增/修改哪些模块、数据流如何变化
> 4. **用户确认** — 将以上分析呈现给用户，等待明确同意后再开始实现

---

## 项目概述

**名称**：mewCat（译趣喵）  
**类型**：Chrome MV3 浏览器扩展  
**框架**：WXT 0.21.4（Vite 8）<br>
**语言**：TypeScript 5.8.3<br>
**包管理**：pnpm 10.20.0

浏览器翻译插件，支持沉浸式翻译、划词翻译、图片翻译，通过第三方 LLM API 驱动翻译能力。

---

## 目录结构

```
src/
├── background/          # Service Worker（MV3 后台脚本）
│   ├── index.ts         # 右键菜单、消息路由
│   ├── config/          # canvas-sites、hotlink-sites 配置
│   ├── lib/             # hotlink-dnr（声明式网络请求规则）
│   └── messages/        # 消息处理器（translate-request、translate-image、canvas-hook-event、inject-main-world-hook）
│
├── contents/            # 注入页面的 Content Scripts
│   ├── initialize.tsx              # 语言检测与初始化
│   ├── TranslationControlCenter.tsx # 主翻译控制器（浮动按钮）
│   ├── selectionTranslate.tsx      # 划词翻译
│   ├── imageTranslate.tsx          # 图片翻译 UI
│   ├── MewCat.tsx                  # mewCat 页面 token 同步脚本
│   ├── bridges/canvas-hook-bridge.ts
│   └── inject/canvas-image-hook.ts
│
├── entrypoints/         # WXT 入口（background、content scripts、popup、options、sidepanel）
├── messaging/           # 类型安全的扩展消息协议
├── popup/               # 弹出窗口（点击扩展图标）
├── sidepanel/           # 侧边栏
├── options/             # 设置页（Basic、TranslateServices、Selection、Image、About）
│
├── components/          # 可复用 React 组件（25+）
├── translation/         # 核心翻译引擎（见下方详述）
├── state/               # Jotai 状态管理
├── services/            # 服务层（HTTP 请求）
├── types/               # TypeScript 类型定义
├── constants/           # 应用常量
├── utils/               # 工具函数
└── hooks/               # React Hooks
```

---

## 核心架构

### 翻译引擎（src/translation/）

```
ImmersiveTranslator.ts       # 沉浸式翻译编排器（入口）
UniversalTranslator.ts       # 通用翻译器，对接各 LLM 平台
TranslationServiceManager.ts # 根据配置选择并管理翻译器实例
DOMTraverser.ts              # DOM 树遍历与文本节点提取
DomSelector.ts               # DOM 元素选择与去重
MutationObserverManager.ts   # 动态内容监听（SPA 页面）
RuleEngine.ts                # 按站点规则过滤翻译目标
cache/                       # 两级缓存（L1 内存 + L2 IndexedDB）
```

**翻译流程**：

1. `initialize.tsx` 检测页面语言（franc 库）
2. `DOMTraverser` 遍历 DOM，提取待翻译文本节点
3. `RuleEngine` 按站点规则过滤
4. `TieredTranslationCache` 查缓存，命中则直接渲染
5. `TranslationServiceManager` 选取当前模型对应的 `UniversalTranslator`
6. `UniversalTranslator` 构建请求并调用第三方 LLM API
7. 翻译结果写入缓存，`ImmersiveTranslator` 将译文插入 DOM

### 状态管理（src/state/，Jotai）

| Atom                 | 文件            | 说明                                  |
| -------------------- | --------------- | ------------------------------------- |
| `configAtom`         | state/config.ts | 主配置，持久化到 Chrome local storage |
| `updateConfigAtom`   | state/config.ts | 更新配置的写入 atom                   |
| `userAtom`           | state/user.ts   | 用户信息（头像、手机号等）            |
| `accessTokenAtom`    | state/user.ts   | 访问 token，持久化                    |
| `refreshTokenAtom`   | state/user.ts   | 刷新 token，持久化                    |
| `fetchUserAtom`      | state/user.ts   | 触发拉取用户信息                      |
| `setAccessTokenAtom` | state/user.ts   | 设置 token 并同步到请求头             |

### 服务层（src/services/）

- **request.ts**：`mewCatRequest`（Axios 实例），含 401 自动刷新 token 拦截器
- **user.ts**：调用后端接口获取用户信息、订阅额度、模型列表
- **imageTranslation.ts**：图片翻译服务

### AI 模型系统

**平台枚举**（`src/types/aiModel.ts`）：

```
HUOSHAN / BAILIAN / ZHIPU / HUNYUAN / DEEPSEEK /
OPENAI / MOONSHOT / GEMINI / BASE / DEEPL / DEEPLX
```

**BaseModel 结构**：

```typescript
{
  id: string
  type: AiModel_Platform_Enum
  enabled: boolean
  name: string
  params: {
    modelName: string        // 可编辑的模型标识符，直接作为 API 的 model 字段
    baseUrl?: string         // 仅自定义模式下持久化
    isOfficial?: boolean     // true = 用 PLATFORM_OFFICIAL_BASE_URLS 的官方地址
    apiKey: string
  }
}
```

**官方 / 自定义**：`isOfficial` 为 true 时 baseUrl 不落库，统一从 `PLATFORM_OFFICIAL_BASE_URLS`（`src/constants/model.ts`）取；自定义模式下才使用 `params.baseUrl`。用户在设置页填写 API Key，`UniversalTranslator` 直接调用对应平台 API。

### CSS 类名 / DOM 属性前缀

所有注入页面的 DOM 标识符统一使用 `mewcat-` 前缀：

| 标识符                       | 用途                      |
| ---------------------------- | ------------------------- |
| `mewcat-container`           | 翻译结果容器              |
| `mewcat-wrapper`             | 翻译文本包装              |
| `mewcat-error-container`     | 错误提示容器              |
| `mewcat-error-modal`         | 错误详情弹窗              |
| `mewcat-retry-btn`           | 重试按钮                  |
| `data-mewcat-parent-node-id` | 翻译节点唯一 ID           |
| `data-mewcat-canvas-id`      | Canvas 元素 ID            |
| `mewcat-canvas-hook`         | Canvas Hook 通信频道      |
| `__mewCatCanvasHookState__`  | Window 上的 Hook 状态标记 |

---

## 关键配置

### 默认扩展配置（src/state/constants.ts）

```typescript
{
  isSelectedTranslate: true,
  targetLanguage: "zh-CN",
  currentModel: "google-translate",
  enableGoogleTranslate: true,
  enableMicrosoftTranslate: true,
  maxRequestsPerSecond: 3,
  maxTextLengthPerRequest: 1024,
  selectionTriggerMode: "direct",
  cacheEnabled: true,
  enableThinking: false,
  enableContext: false,
  enableImageTranslateButton: false
}
```

### 环境变量

| 变量                         | 说明                  | 默认值   |
| ---------------------------- | --------------------- | -------- |
| `WXT_ENABLE_CANVAS_REBUILD`  | 是否启用 canvas 重建  | `"true"` |
| `WXT_CANVAS_ROLLOUT_PERCENT` | canvas 功能灰度百分比 | `"100"`  |

两者都在 `src/background/config/canvas-sites.ts` 内有代码级默认值，**构建不需要 `.env` 文件，也不需要任何 secret**。

> 注：早期文档中记载的 `PLASMO_PUBLIC_DOC2X_API_DOMAIN` 已随 SYSTEM 平台一并移除，`src/` 中不再有任何引用。

---

## 构建与开发

```bash
pnpm dev          # 开发模式（热重载）
pnpm build        # WXT 生产构建并生成带日期的 ZIP
pnpm typecheck    # TypeScript 检查
pnpm lint         # ESLint
pnpm format       # Prettier 格式化
pnpm check        # 全量检查
pnpm package      # 打包为带日期的 ZIP
pnpm crx          # 打包签名 .crx（需 key.pem 或 CRX_PRIVATE_KEY）
```

**构建流程**：`wxt build` → `scripts/package-with-date.cjs`（WXT ZIP 打包并添加日期后缀）。`pnpm obfuscate` 是可选的独立步骤，不属于默认发布流程。

---

## CI / 自动发布

`.github/workflows/release.yml`：push 到 `main` 时自动执行。

**流程**：`pnpm install --frozen-lockfile` → **`pnpm check`（门禁，失败即中止）** → 读取 `package.json` 的 `version` → 新版本执行 `pnpm build` + `pnpm crx` 并将固定产物保存为 draft GitHub Release → 通过 GitHub OIDC 获取 Chrome Web Store 短期令牌 → 校验并上传同一份 ZIP，以 `DEFAULT_PUBLISH` 提交审核 → 将 draft 转为 pre-release。商店审核通过后自动发布扩展。

**发版方式**：手动 bump `package.json` 的 `version` 并推到 `main`。已完成的 Release 会幂等跳过；未完成的 draft 只允许原提交重跑，并复用其中的原始 ZIP/CRX；后续提交若未升级 version 会失败，避免商店包与 GitHub Release 出现同版本不同产物。

**依赖的仓库配置**：

- Settings → Actions → General → Workflow permissions 设为 **Read and write permissions**
- Secret `CRX_PRIVATE_KEY_B64`：crx 签名私钥的 base64，由 `node scripts/gen-crx-key.cjs` 生成
- Actions Variables `CWS_WORKLOAD_IDENTITY_PROVIDER`、`CWS_SERVICE_ACCOUNT`、`CWS_PUBLISHER_ID`、`CWS_EXTENSION_ID`：Chrome Web Store OIDC 和扩展标识配置；不保存 Google JSON 私钥，完整配置见 `docs/chrome-web-store-automation.md`
- Workflow 内所有第三方 Actions 固定到完整 commit SHA，避免可变 tag 被替换

**关于 crx 私钥**：扩展 ID 由私钥推导，必须固定。`key.pem` 已被 `.gitignore` 排除，丢失后无法恢复，已通过 crx 安装的用户将收不到更新。

---

## Manifest 权限

```json
{
    "host_permissions": [
        "<all_urls>",
        "http://*/*",
        "https://*/*",
        "https://v2c.doc2x.noedgeai.com/*"
    ],
    "permissions": [
        "storage",
        "tabs",
        "scripting",
        "windows",
        "contextMenus",
        "declarativeNetRequest",
        "declarativeNetRequestWithHostAccess"
    ]
}
```

---

## 修改记录

### 2026-09-07 — Options 新增生成式 AI Token 用量统计

**修改内容**：

- `src/token-usage/`：新增 token 用量类型、混合中英文估算、常见 API usage 字段归一化，以及基于 Zod 字段级修复的每日聚合存储；仅保留最近 30 天数据，并支持安全清空
- `src/background/messages/model-gateway.ts`、`src/messaging/modelGatewayContracts.ts`：模型网关接入统一用量采集，优先使用 xsAI 返回的真实 usage，缺失时本地估算；统计写入失败不会影响翻译结果
- `src/translation/modelTranslation.ts`、`src/image-translation/providers.ts`：按网页翻译、划词翻译、概念解释、页面摘要、图片翻译标记调用来源；Google Translate、DeepL、DeepLX 不进入 token 统计
- `src/constants/storage.ts`：新增环境隔离的 `token-usage` / `token-usage-dev` 存储键
- `src/options/TokenUsage.tsx`、`src/options/index.tsx`、`src/constants/options.ts`：options 新增“统计”页面，展示今日、近 7 天、近 30 天总量以及按日期、模型、功能和真实/估算来源拆分的明细，并提供二次确认清空
- `test/token-usage.test.ts`、`test/token-usage-ui.test.tsx`：新增估算、usage 归一化、异常数据修复、聚合清理和 options 展示测试，并纳入 `pnpm check`

**原因**：为开发者提供不包含原文、译文、prompt、图片或 API Key 的本地 token 消耗数据，便于后续按模型和功能定位优化重点，同时保证统计数据异常不会影响插件执行。

> **格式**：每次修改后在此追加，格式如下：
>
> ```
> ### YYYY-MM-DD — 简短标题
> **修改内容**：具体改了什么文件、什么逻辑
> **原因**：为什么要改
> ```

---

### 2026-05-11 — 品牌重命名：Doc2X → 译趣喵 (mewCat)

**修改内容**：

- `package.json`：`name` 改为 `mewcat-plugin-browser`，`displayName` 改为 `mewCat`
- `src/config/index.ts`：常量 `DOC2X_MATCHES` → `MEWCAT_MATCHES`，`DOC2X_FRONTEND_URL` → `MEWCAT_FRONTEND_URL`，函数 `isDoc2xPage` → `isMewCatPage`
- `src/constants/common.ts`：`DOC2X_URL` → `MEWCAT_URL`
- `src/state/constants.ts`：系统模型显示名 `"Doc2X"` → `"mewCat"`
- `src/services/request.ts`：`doc2xRequest` → `mewCatRequest`（含拦截器内所有引用）
- `src/services/user.ts`：同步更新 `mewCatRequest`
- `src/state/user.ts`：同步更新 `mewCatRequest`
- `src/popup/index.tsx`、`src/components/SettingsPanel/index.tsx`：UI 标题 `"Doc2X 翻译"` → `"译趣喵"`，import 同步更新
- `src/options/index.tsx`：侧边栏标题 `"Doc2X 翻译助手"` → `"译趣喵"`
- `src/sidepanel/index.tsx`：alt 文本更新
- `src/types/user.ts`：`Doc2xUserInfo` → `MewCatUserInfo`
- `src/types/canvas-hook.ts`：channel 常量 `"doc2x-canvas-hook"` → `"mewcat-canvas-hook"`
- `src/contents/bridges/canvas-hook-bridge.ts`：所有 `doc2x-canvas-*` 属性/前缀 → `mewcat-canvas-*`
- `src/contents/inject/canvas-image-hook.ts`：函数名 `installDoc2xCanvasImageHook` → `installMewCatCanvasImageHook`，window 状态标记 `__doc2xCanvasHookState__` → `__mewCatCanvasHookState__`，canvas 属性前缀更新
- `src/background/messages/inject-main-world-hook.ts`：同步更新函数引用
- `src/utils/dom.ts`：所有 CSS 类名 `doc2x-*` → `mewcat-*`，DOM 属性 `data-doc2x-*` → `data-mewcat-*`
- `src/translation/DomSelector.ts`、`DOMTraverser.ts`、`MutationObserverManager.ts`：同步更新属性/选择器
- `src/contents/imageTranslate.tsx`：canvas overlay 属性更新
- `src/background/messages/translate-image.ts`：canvas 属性查询更新
- `src/contents/Doc2x.tsx` → 重命名为 `src/contents/MewCat.tsx`，内部组件名、函数名全部更新
- `README.md`：标题更新

**原因**：将插件品牌从 Doc2X 完整迁移到译趣喵 (mewCat)，移除所有对外可见的 Doc2X 标识。后端 API 域名（`doc2x.noedgeai.com`）作为功能性端点保留不变。

---

### 2026-05-12 — 修复 typecheck / spell / hotlink-rules 全部报错

**修改内容**：

- `src/types/aiModel.ts`：`AiModel_Platform_Enum` 新增 `SYSTEM = "SYSTEM"` 成员；`BaseModel` 新增 `isSystem?: boolean` 属性
- `src/constants/model.ts`：新增 `SYSTEM_LLM_MODEL_NAMES: Record<SystemLLMModel, string>` 常量（29 个 SystemLLMModel 枚举值到模型名称的映射）
- `src/constants/translationServices.ts`：`platformNameMap` 补上 `[AiModel_Platform_Enum.SYSTEM]: "系统模型"`
- `src/components/SettingsPanel/index.tsx`：删除 70 行未实现的用户卡片/额度显示区块（引用不存在的 `userAtom`、`UserCard` 等 styled-components，导致 31 个 typecheck 错误）
- `src/background/config/hotlink-sites.generated.ts`：重新同步生成
- `.cspell/custom-words.txt`：新增 53 个项目专有词汇

**原因**：

1. `SYSTEM_LLM_MODEL_NAMES` 在 `llmModel.ts` 中从 `@/constants/model` 导入但从未定义，导致 options 页面打开时 `Cannot read properties of undefined (reading '32')`
2. `AiModel_Platform_Enum` 缺少 `SYSTEM` 成员，`BaseModel` 缺少 `isSystem` 属性，多个文件引用但缺失定义
3. 拼写检查无自定义词典
4. hotlink-sites 生成文件过期

---

### 2026-05-13 — 主题色修改为橙色

**修改内容**：

- `src/styles/theme.scss`：主题色系从紫色改为橙色——`--primary-color: #f97316`、`--primary-hover: #ea580c`、`--primary-light: #fff7ed`、`--primary-muted: #fb923c`；同步更新 `--border-focus`、`--gradient-primary-soft`、`--shadow-primary`、`--shadow-primary-sm` 及 input focus 的 box-shadow rgba 值
- `src/utils/style.ts`：翻译高亮色从蓝色 `#1976d2` 改为橙色 `#f97316`，同步更新所有翻译样式（HIGHLIGHT、UNDERLINE、BACKGROUND、BORDER、SHADOW）的颜色值及相关 rgba，更新样式描述文字

**原因**：将插件整体主题色从紫色改为橙色

**修改内容**：

- `src/translation/UniversalTranslator.ts`：`checkConnection` 方法中，非 DEEPL 的 AI 提供商测试路径增加内部字段剥离逻辑——将 `requestBody.config` 中的 `apiKey`、`baseUrl`、`headers`、`timeout` 字段解构移除后，只发送 `model` + `messages` + `thinking` 作为 API 请求体，与 background handler（`translate-request.ts`）的处理方式对齐

**原因**：`checkConnection` 直接通过 axios 发送请求，原有代码将整个 `UnifiedRequestBody.config`（含内部路由字段）作为 POST body 发送给目标 API，导致 DeepSeek 等严格校验未知字段的接口拒绝请求；实际翻译通过 background handler 走 `fetch` 时会正确剥离这些字段

---

### 2026-05-18 — 修复 typecheck / lint 全量检查报错

**修改内容**：

- `.plasmo/index.d.ts`、`.plasmo/messaging.d.ts`：新增 Plasmo 生成文件（tsconfig 中已 include 但缺失），`messaging.d.ts` 通过模块扩充将 `canvas-hook-event`、`translate-request`、`translate-image`、`inject-main-world-hook` 注册到 `MessagesMetadata`，修复 `sendToBackground` 的 `name` 字段类型为 `never` 的问题
- `src/types/aiModel.ts`：新增 `SystemLLMModel` 枚举（31 个成员，数值 0–30），对应系统模型后端的 LLM 模型 ID
- `src/constants/model.ts`：补充 `SystemLLMModel` 导入，修复 `SYSTEM_LLM_MODEL_NAMES` 常量的类型引用
- `src/state/user.ts`：移除对不存在的 `request`（axios 实例）的导入及 `request.defaults.headers.Authorization` 赋值（服务层已无 axios 实例）；`setAccessTokenAtom` 的 `get` 参数改为 `_get`
- `src/state/index.ts`：补充 `export * from "./user"`，使 `accessTokenAtom` 等 atom 可从 `@/state` 统一导入
- `src/sidepanel/index.tsx`：将 JSX 中误用的 `<Title>` 改为已定义的 styled-component `<HeaderTitle>`；`catch (e: any)` 改为 `catch (e)` + 类型断言，消除 `@typescript-eslint/no-explicit-any` 错误
- `src/translation/UniversalTranslator.ts`：移除 `baseUrls` 中不存在于 `AiModel_Platform_Enum` 的 `GOOGLE` 和 `BASE` 条目
- `src/background/config/hotlink-sites.generated.ts`：重新同步生成（`pnpm check:hotlink-rules` 检测到过期）

**原因**：多处类型定义缺失或引用错误导致 typecheck 报 43 个错误，lint 报 1 个 error；hotlink-rules 生成文件过期

---

### 2026-05-19 — 新增插件 Logo 及 Prettier 自动格式化 hook

**修改内容**：

- `assets/icon.png`：替换为新设计的 mewCat 品牌 Logo——橙色圆角方形背景，扁平风格猫脸（奶油色头部、琥珀色眼睛、粉色鼻子、胡须、腮红），512×512 RGBA PNG，由 `scripts/gen-icon.js` 生成
- `scripts/gen-icon.js`：新增图标生成脚本，使用纯 Node.js + zlib 实现抗锯齿像素绘制，无外部依赖
- `.Codex/settings.json`：新增 PostToolUse hook，在每次 Write/Edit `src/` 文件后自动执行 `pnpm format`
- `AGENTS.md`：新增格式规则说明

**原因**：品牌视觉统一，替换旧图标；自动化 Prettier 格式检查减少人工操作

---

### 2026-05-21 — AI 模型配置：删除模型版本下拉、加官方/自定义切换、移除 SYSTEM 平台

**修改内容**：

- `src/types/aiModel.ts`：删除 `AiModel_Platform_Enum.SYSTEM` 枚举成员、`SystemLLMModel` 枚举、`BaseModel.isSystem` 字段、`BaseModel.params.modelVersion` 字段；`BaseModel.params.modelName` 改为 `string`（去掉 number 联合）、`BaseModel.params` 新增 `isOfficial?: boolean`
- `src/constants/model.ts`：删除 `SYSTEM_LLM_MODEL_NAMES` 和 `THINKING_CAPABLE_MODELS` 常量；新增 `THINKING_CAPABLE_PLATFORMS`（按平台白名单：DEEPSEEK/MOONSHOT/BAILIAN/HUOSHAN/GEMINI/ZHIPU/HUNYUAN）和 `PLATFORM_OFFICIAL_BASE_URLS`（每个平台的官方默认请求地址）
- `src/constants/translationServices.ts`：`platformNameMap` 移除 SYSTEM 项
- `src/utils/llmModel.ts`：删除 `getLLMModelName` 和 `isThinkingCapableModel`；重写 `isModelThinkingCapable` 按 platform 白名单判断
- `src/options/constants.ts`：删除 SYSTEM 整项；所有平台 `items` 数组中的 `modelVersion` → `modelName`；删除全部 `modelVersion` 字段定义；`testValidator` 类型补齐 `validateDeeplApiKey`/`validateDeeplxApiKey`
- `src/options/TranslateServices.tsx`：删除 modelVersion 下拉渲染分支与 `modelOptions`；新增「模型类型」官方/自定义切换按钮组；新增「请求地址」FormRow（官方时禁用并展示该平台默认 URL，自定义时可编辑）；`LeftPanelItem` 副标题改用 `modelName`；`handleAddModel` 改为初始化 `isOfficial: true` + 平台 `defaultValue`；`handleTestModel`/`handleTestSingleModel` 改用 `modelName` 和 `resolveBaseUrl`
- `src/components/ApiKeyInput/index.tsx`：新增 `disabled` prop 支持只读展示
- `src/translation/TranslationServiceManager.ts`：删除 `getLLMModelName` 导入；模型字符串改用 `params.modelName`；根据 `isOfficial` 显式选择 baseUrl（官方→`PLATFORM_OFFICIAL_BASE_URLS`，自定义→`params.baseUrl`）
- `src/components/ModelTestPanel/index.tsx`：删除 `storage`/`getLLMModelName`/`LLMModel` 导入与 `isSystem` 分支；`ModelTestResult.model` 类型由 `LLMModel` 改为 `string`；改用 `modelName` 和按 `isOfficial` 显式计算的 baseUrl
- `src/sidepanel/index.tsx`：删除 `handleTranslate` 中针对 `AiModel_Platform_Enum.SYSTEM` 注入 `accessToken` 的逻辑；同步移除 `accessTokenAtom`/`AiModel_Platform_Enum` 导入
- `src/background/config/hotlink-sites.generated.ts`：重新同步生成

**原因**：按用户要求重构 AI 模型配置 UX。先前 `modelVersion`（LLMModel 枚举数字下拉）既做 UI 选择又当 API 模型标识符，限制了用户接入新模型；改为可编辑 `modelName` 输入框后用户可填写任意模型字符串。同时引入「官方/自定义」二态简化 baseUrl 配置（官方时只读展示默认地址，自定义时可填代理/私有部署 URL）。系统模型（SYSTEM 平台）依赖 mewCat 后端的固定 URL，与「官方/自定义」语义不匹配且增加分支复杂度，按用户要求一并清理。存量用户的 `modelVersion` 数据通过类型层删除静默忽略，老用户首次进入设置页只需重新选择模型类型。

---

### 2026-05-21 — 移除侧边栏的设置 tab 及其 UI

**修改内容**：

- `src/sidepanel/index.tsx`：移除 `SettingsPanel` 组件导入；删除 `TabBar` / `Tab` / `SettingsPane` 三个 styled-components；删除 `TabId` 类型与 `activeTab` 状态；移除「快捷翻译」「设置」tab 切换栏；移除 `{activeTab === "settings" && <SettingsPanel />}` 渲染分支；快捷翻译面板由原先的条件渲染改为常驻渲染
- `src/background/config/hotlink-sites.generated.ts`：重新同步生成（与本次改动无关，`pnpm check:hotlink-rules` 检测到过期）

**原因**：按用户要求移除侧边栏中的设置入口。设置功能由扩展独立的 options 页与 popup 中的 `SettingsPanel` 已覆盖，侧边栏只保留快捷翻译用途。`SettingsPanel` 组件本身被 `TranslationControlCenter` 继续使用，未删除。

---

### 2026-05-21 — 修复 OpenAI 兼容代理缺少 `/v1` 路径段时调试不通过

**修改内容**：

- `src/translation/UniversalTranslator.ts`：抽出 `buildOpenAICompatibleUrl()` 方法，替换 `buildRequestUrl()` default 分支原本简单的 `${baseUrl}/chat/completions` 拼接。新逻辑按优先级处理三种用户输入：(1) 已是完整 `/chat/completions` 端点 → 原样返回；(2) baseUrl 已含版本路径段（正则 `/v\d+(\.\d+)?(/|$)` 匹配 `/v1`、`/v3`、`/api/v3`、`/paas/v4`、`/compatible-mode/v1` 等）→ 仅补 `/chat/completions`；(3) 仅填了域名（如 `https://api.freemodel.dev`）→ 补 `/v1/chat/completions`
- `.cspell/custom-words.txt`：新增 `paas` 词条（注释中提到的智谱 `/api/paas/v4` 路径段）

**原因**：用户反馈 OpenAI 平台填写第三方代理地址 `https://api.freemodel.dev` 后「检测连接」失败。根因是原代码直接拼接得到 `https://api.freemodel.dev/chat/completions`，但绝大多数 OpenAI 兼容代理（freemodel、one-api、oneapi 类网关等）实际端点是 `/v1/chat/completions`。官方 OpenAI 默认 baseUrl `https://api.openai.com/v1` 自带 `/v1` 掩盖了这个问题，但用户填代理域名时常忽略 `/v1`。修复采用智能 URL 规整而非强制 `/v1`，避免破坏 HUOSHAN（`/api/v3`）、ZHIPU（`/api/paas/v4`）、BAILIAN（`/compatible-mode/v1`）等带不同版本路径段的官方默认地址，同时允许用户输入完整 `chat/completions` 端点（部分代理直接给出完整 URL）。该变更同时作用于实际翻译请求和「检测连接」流程，两者都通过 `buildRequestUrl()` 获取 URL。

---

### 2026-05-21 — 修复 DeepSeek / Moonshot 因错误注入 `thinking` 参数导致 API 拒绝

**修改内容**：

- `src/translation/UniversalTranslator.ts`：`buildThinkingConfig()` 的 `thinking: {type: ...}` 分支移除 `DEEPSEEK` 和 `MOONSHOT` case，二者落入 `default` 不再注入任何思考相关字段；HUOSHAN 保留（火山引擎 Ark API 原生支持 `thinking.type`）
- `src/constants/model.ts`：`THINKING_CAPABLE_PLATFORMS` 移除 DEEPSEEK / MOONSHOT / ZHIPU / HUNYUAN，仅保留实际有 API 参数级思考开关的 BAILIAN / HUOSHAN / GEMINI

**原因**：用户反馈 DeepSeek 官方模型「无法调用」。排查发现 `buildThinkingConfig` 对 DEEPSEEK / MOONSHOT 同样注入 `thinking: {type: "enabled" | "disabled"}` 字段，但这是火山引擎 Ark 专有的 OpenAI 扩展字段，DeepSeek 和 Moonshot 的官方 API 不识别。DeepSeek 启用 `enableThinking=false` 默认值时，请求体会带上 `thinking: {type: "disabled"}`，遇到严格校验的网关/最新 API 版本直接 400 拒绝。DeepSeek 推理切换实际是通过模型名（`deepseek-reasoner` vs `deepseek-chat`）实现的；Moonshot 思考切换通过 `kimi-k2-thinking` 等模型名实现，二者都没有独立的开关参数。THINKING_CAPABLE_PLATFORMS 同步清理 ZHIPU/HUNYUAN（buildThinkingConfig 本就无对应分支，开关在 UI 上是空操作），白名单仅保留参数级支持的三个平台。OPENAI 平台原本就走 default 分支不注入 thinking，本次修复不影响其行为。

---

### 2026-05-21 — 官方模型 baseUrl 不再持久化，统一从 PLATFORM_OFFICIAL_BASE_URLS 取

**修改内容**：

- `src/translation/UniversalTranslator.ts`：删除 `getBaseUrl` 内部硬编码的 `baseUrls` 字面量（与 `PLATFORM_OFFICIAL_BASE_URLS` 重复），改为从 `@/constants/model` 导入；`customUrl` 改用 `trim()` 后非空判断，空字符串/纯空白也会回退到 `PLATFORM_OFFICIAL_BASE_URLS[provider]`
- `src/options/TranslateServices.tsx`：`handleSourceChange` 切换到「自定义」时不再用 `PLATFORM_OFFICIAL_BASE_URLS[type]` 作为初始值塞入 `config.baseUrl`，直接留空让用户主动填；`resolveBaseUrl` 在 `isOfficial` 时返回空串（让 `UniversalTranslator` 内部 fallback）而不是手动查映射
- `src/translation/TranslationServiceManager.ts`：移除 `PLATFORM_OFFICIAL_BASE_URLS` 导入；构造 `UniversalTranslator` 时 `isOfficial` 直接传 `undefined`，仅自定义模式传 `model.params.baseUrl`
- `src/components/ModelTestPanel/index.tsx`：同上简化
- `src/background/config/hotlink-sites.generated.ts`：重新同步生成

**原因**：旧实现里官方 baseUrl 在三处重复硬编码（`UniversalTranslator.getBaseUrl` 内联表、`PLATFORM_OFFICIAL_BASE_URLS`、以及 `handleSourceChange` 切到自定义时塞进 `config.aiModelList[].params.baseUrl` 的持久化数据），改地址需要三处同步。本次统一以 `PLATFORM_OFFICIAL_BASE_URLS` 为唯一数据源——`UniversalTranslator` 内部 fallback、UI 显示「官方模式」时只读展示、调用方 `isOfficial` 时不传 baseUrl，均指向这一个常量。持久化层只保留用户真正填写的自定义地址，避免「修改官方默认值要同步修改用户旧数据」的耦合。`TranslateServices.tsx` 中「请求地址」FormRow 官方模式下的展示值仍走 `PLATFORM_OFFICIAL_BASE_URLS` 映射，纯 UI 展示不写回 config。存量用户：之前切过自定义然后切回官方的模型，`baseUrl` 字段可能残留官方 URL 字符串，但由于调用方在 `isOfficial=true` 时已忽略该字段直接走 fallback，无功能影响，不做迁移。

---

### 2026-08-06 — 新增 GitHub Actions 自动构建发布流水线

**修改内容**：

- `.github/workflows/release.yml`：新增。push `main`（及手动 `workflow_dispatch`）触发，单 job 依次执行 `pnpm install --frozen-lockfile` → `pnpm check`（质量门禁，失败即中止）→ 读取 `package.json` 的 `version` 判断 tag `v{version}` 是否已存在 → 不存在则 `pnpm build` + `pnpm crx` → `gh release create` 创建 pre-release 并上传 `mewcat-v{version}.zip` 与 `mewcat-v{version}.crx`。声明 `permissions: contents: write`，用 `concurrency` 串行化同分支 push 防止并发创建同一 Release，私钥经 `if: always()` 步骤清理
- `scripts/build-crx.js`：修复三处缺陷 —— (1) `sourceDir` 由不存在的 `build/chrome-mv3` 改为实际产物目录 `build/chrome-mv3-prod`，且目录缺失时报错退出；(2) 私钥改为 `CRX_PRIVATE_KEY` 环境变量优先、其次 `key.pem`，**两者都无时直接报错退出**，不再回退到自动生成随机密钥；(3) `.catch` 内补 `process.exit(1)`，失败不再返回 0。同时修正 `load()` 返回值被误当作 Buffer 写入的 bug（`crx` 的 `load()` 返回实例，需再调 `pack()` 才得到 Buffer），移除占位的 `appId` / `codebase`，输出路径改为 `release/mewcat-v{version}.crx`
- `package.json`：`crx` 依赖 `3.0.1` → `5.0.1`
- `scripts/gen-crx-key.js`：新增一次性工具，用 Node 内置 `crypto.generateKeyPairSync` 生成 pkcs1 RSA 2048 私钥，写出 `key.pem`（权限 0600）并打印 base64 串供粘贴到 GitHub Secret；已存在 `key.pem` 时拒绝覆盖
- `.gitignore`：新增 `key.pem`、`*.pem`、`release/`、`dist-assets/`
- `AGENTS.md`：新增「CI / 自动发布」章节；「环境变量」表勘误（原记载的 `PLASMO_PUBLIC_DOC2X_API_DOMAIN` 已无任何代码引用，实际生效的是 `PLASMO_PUBLIC_ENABLE_CANVAS_REBUILD` 和 `PLASMO_PUBLIC_CANVAS_ROLLOUT_PERCENT`，二者均有代码级默认值）；AI 模型系统章节的平台枚举与 `BaseModel` 结构同步 2026-05-21 的改动（移除已删除的 `SYSTEM` / `isSystem` / `modelVersion`，补充 `isOfficial`）

**原因**：此前发版全靠人工在本地跑 `pnpm build` 再手动上传产物，容易漏跑质量检查，也没有可追溯的版本记录。

几个设计选择的理由：

- **发布判据用「tag 是否已存在」而非 diff `HEAD~1` 的 package.json**：前者对 squash merge、同版本多次 push、workflow 重跑都是幂等的，后者在这些场景下会误判
- **crx 私钥必须固定且不能静默生成**：扩展 ID 由私钥推导，随机密钥意味着每次发布都是一个「新扩展」，已安装用户永远收不到更新。原脚本在无 `key.pem` 时静默生成随机密钥，属于会悄悄产出错误结果的缺陷，故改为硬失败
- **私钥以 base64 存 Secret**：避免多行 PEM 在 secret 注入时被换行符处理影响
- **用 runner 预装的 `gh` CLI 而非第三方 release action**：减少供应链攻击面
- **升级 `crx` 到 5.0.1**：3.0.1 的 `loadContents()` 依赖 archiver 的 `readable` 事件累积 Buffer，在当前 Node 22 下会读到 `null` 导致 `Cannot read properties of null`；5.0.1 重写了该实现，且默认产出 CRX3 格式（3.0.1 产出的是 Chrome 已废弃的 CRX2）。npm 上 `crx` 全系列已标记 deprecated，但仍是可用的方案，后续如遇问题可迁移到 `crx3` 包

**验证**：本地已验证 —— 构建产物解压抽查确认 JS 已混淆（`plasmo package` 不会覆盖 `obfuscate.js` 的就地修改）；crx 产出文件魔数为 `Cr24` + 版本字节 `03`（CRX3）；删除 `key.pem` 后 `pnpm crx` 报错且退出码为 1；base64 → 环境变量的 CI 路径打包成功；`git check-ignore` 确认 `key.pem` 不会被提交；`pnpm check` 通过。CI 端待用户配置好 Actions 写权限和 `CRX_PRIVATE_KEY_B64` Secret 后首次 push 验证。

---

### 2026-08-07 — UI 全面重设计：「宣纸朱印」

**修改内容**：

_Token 与基础样式_

- `src/styles/theme.scss`：整体重写。**选择器由 `:root` 改为 `:root, :host`**；主题色由橙 `#f97316` 改为朱砂 `#b23a2e`，背景由白改纸（`--bg-primary: #f2ede1` / `--bg-secondary: #fbf8f0` / `--bg-tertiary: #eae3d4`），文字改墨（`#1a1714`），灰阶整体偏暖；圆角收到近方（`--radius-sm/md: 2px`、`lg: 4px`、`xl: 6px`，`full` 仅留给印章与帮助图标）；阴影全面减轻；成功色改石青 `#3e6b63`；新增 `--seal-wash` / `--seal-ring` / `--rule-strong` / `--paper-3` / `--jade` / `--font-display`（宋体族）/ `--font-mono`；新增 `--space-7: 28px`（原缺失，见下）；全部 mixin（`btn-*`、`input-base`、`card-*`、`list-item`）同步改写，新增 `seam`（骑缝线）mixin；删除文件末尾注释掉的深色模式死代码
- `src/styles/options.scss`、`src/styles/popup.scss`：删除约 200 行引用不存在变量（`--gradient-header`、`--spacing-lg`、`--error-color`、`--border-radius-small` 等）的死代码，重写为纸底 + 细滚动条 + `prefers-reduced-motion` 降级；焦点样式由 `outline: none` 改为 `:focus-visible { outline: 2px solid var(--primary-color) }`

_Options 结构_

- `src/components/OptionsSidebar/index.tsx`：横排列表 → 76px 书脊式竖排目录（`writing-mode: vertical-rl` + 宋体 + 当前项右侧 3px 朱砂竖条），顶部朱砂印 logo；≤900px 降级为横排可滚动 tab 条
- `src/components/OptionsSection/index.tsx`：卡片 → 分节（朱砂小方块 + 宋体标题 + 向右延伸的 hairline），去掉背景/边框/hover
- `src/components/FormRow/index.tsx`：堆叠 → 术语/注解双栏（左列 208px 放 label + 说明，右列放控件），行间 hairline 分隔；≤900px 堆叠
- `src/components/OptionsContentHeader/index.tsx`：改为 masthead —— 宋体大标题「譯趣貓」+ 等宽版本号 + 右侧常驻状态摘要 + 骑缝线。props 由 `title/description` 改为 `title/version/status`
- `src/options/index.tsx`：接入 `configAtom` 计算状态摘要（`英语 → 简体中文 · DeepSeek`）传给 masthead；标题不再随 tab 变化（当前页已由书脊朱砂竖条指示）

_控件_

- `src/components/Switch/index.tsx`：圆 pill → 方形木闸，开合由「滑块位置 + 滑块颜色」双重编码（非纯色彩），新增 `:focus-visible` 环
- 8 处紫色残留 `rgba(119,72,249,…)` → `var(--seal-ring)` / `var(--seal-wash)`：`ApiKeyInput`、`NativeSelect`、`NumberInput`、`Select`、`UrlManager`、`sidepanel`、`SettingsPanel`、`popup`
- `src/components/Select/index.tsx`、`src/options/TranslateServices.tsx`：选中项由「浅底变色」改为「`--seal-wash` 底 + `inset 3px 0` 朱砂左边」，不靠投影
- `src/components/Button/index.tsx` 的 `#dc2626`、`InfoDisplay` 的 `rgba(25,118,210,.1)` 与三个不存在的变量、`StylePreview` 整块注释死代码、`SettingGroup` 的圆点指示器 → 一律换 token / 方块
- `src/components/Tooltip/index.tsx`：黑底改墨底纸字、圆角收到 2px，并加 `width: max-content`

_悬浮球与面板_

- `src/contents/TranslationControlCenter.tsx`：圆形浅紫球 + `icon.png` → 54px 朱砂方印（8px 圆角、内嵌 1.5px 纸色描边、宋体白字「譯」、静止态 0.84 不透明）。新增两个状态层：翻译中外沿朱砂虚线环缓转 5s（研墨）、落定时墨渍一次性扩散 0.62s（落印），并保留石青方形「已译」角标作为动画结束后的持久标记；两者都在 `prefers-reduced-motion` 下停转但保留形态。齿轮按钮改近方。移除 `iconImg` 依赖。**顺带修了 tooltip 文案 bug**：原为 `loading ? "清理翻译" : "开启翻译"`，翻译完成后 `loading` 为 false 但 `isTranslate` 为 true，会错误显示「开启翻译」，改为 `loading || isTranslate`
- `src/components/SettingsPanel/index.tsx` + `src/popup/index.tsx`：二者原为 95% 逐行重复的两份代码，**合并为 `SettingsPanel` 单一实现**，新增 `variant: "floating" | "embedded"` 区分「悬浮球弹出（自带纸面与投影）」和「popup 窗口内（不叠纸）」；popup 只保留取当前 tab URL 的逻辑。Logo 由 `icon.png` 改朱砂印，头部加骑缝线
- `src/sidepanel/index.tsx`：跟随纸底 + 朱砂印 logo + 骑缝线，移除 `icon.png` 依赖

_页面注入 UI_

- `src/utils/style.ts`：6 种译文样式全部由橙色系改朱砂系。HIGHLIGHT 改「米色底 + 左侧朱砂竖条」，UNDERLINE/BORDER/SHADOW 改为 `color: inherit`（不再强制染色，使其在深色网页上也可读），BACKGROUND 用淡朱砂底 + 细边。**`getStyleDescription` 文案同步改写**（原写「橙色下划线」「黄色背景」，改色后即为错误描述）
- `src/types/translationStyle.ts`：枚举成员的 JSDoc 由「蓝色下划线」「淡蓝色背景」等改为实际描述（这些注释在改色前就已与代码不符）
- `src/utils/dom.ts`：错误 UI 按钮 `#7748f9`/`#6b3fd9`/`#f0eaff` → 朱砂系；loading spinner `#3498db` → 朱砂；错误弹窗改纸底近方（遮罩、标题、详情区、关闭按钮全部换色）
- `src/components/SelectionDot/index.tsx`：蓝色渐变圆点 → 朱砂小方印（4px 圆角 + 内描边），tooltip 改墨底，新增 reduced-motion 降级
- `src/contents/selectionTranslate.tsx`：蓝色渐变 + 12px 圆角 → 纸底 + 4px 圆角 + 顶端朱砂封边
- `src/components/TranslateTextPanel/index.tsx`、`src/components/ImageTranslateButton.tsx`：`#333`/`#666`/`#1976d2`/紫色渐变 → 朱砂与墨

_图标_

- `assets/icon.png`：橙色猫脸 → 朱砂印「譯」（512×512）。生成方式改为浏览器渲染 `design-preview/icon-source.html` 后截图直出
- `scripts/gen-icon.js`：加文件头注释标注已停用（纯 Node + zlib 几何绘制画不出宋体字形），保留作历史参考

_实机验证中发现并修复的 4 个缺陷_

1. **`--space-7` 不存在**：`MainContent` 的 `padding: var(--space-7) var(--space-8) var(--space-10)` 中一个分量无法解析，导致**整条 padding 声明被丢弃**，options 主区完全没有内边距。已在 theme.scss 补 `--space-7: 28px`
2. **grid item 撑破列**：`OptionsSection` 的 `layout="grid"` 下右列内容溢出视口（控件被裁切）。grid item 默认 `min-width: auto`，已显式加 `> * { min-width: 0 }`
3. **两列网格首行错位**：`FormRow` 的分隔线按纵向堆叠设计（只有 DOM 第一个不画线），两列网格下第二个也在首行却画了线并加了 padding-top，导致右列整体下沉。已在 grid 分支加 `&& > *:nth-child(-n + 2)` 抵消，窄屏堆叠时再恢复
4. **`TranslateServices` 无窄屏断点**：左侧模型列表固定 280px + 右侧配置区，在 375px 下右侧被压成一个字宽。已加 ≤900px 上下堆叠

**原因**：原 UI 是「橙色 + 圆角白卡片」的通用后台风格，缺少辨识度。用户要求全新风格、允许大刀阔斧、功能保持不变，并确认了三件事：全部界面统一重排、扩展图标一并更换、不做深色模式。

设计主张：**翻译是「落定文本」。设置页是典籍的目录与注解，悬浮球是一枚朱砂印 —— 开启翻译＝盖章。** 三条规则贯穿全部界面：(1) 朱砂是唯一强调色，石青只用于成功态；(2) 圆角近方，圆形只留给印章与帮助图标；(3) 人写的话用无衬线，机器给的值（模型名、URL、版本号）用等宽，标题用宋体。

几个实现选择的理由：

- **保留全部 CSS 变量名、只重写值**：`src/` 有 848 处 `var(--…)` 分布在 28 个文件，现有变量名都是通用语义（`--primary-color`、`--bg-primary`…），换成朱砂/纸/墨后语义依然成立。为命名洁癖去改 848 处引用是纯风险无收益
- **`theme.scss` 必须 `:root, :host` 双选择器**：`TranslationControlCenter` / `selectionTranslate` / `imageTranslate` 都是 Plasmo CSUI，样式注入 Shadow DOM，而 **`:root` 在 shadow root 内不匹配**。这意味着改动前 `SCxSettingsIcon` 的 `var(--bg-primary)` / `var(--border-color)` 一直是失效的（齿轮按钮实际无背景、边框为黑）。实机已验证：注入 CSUI CSS 后 shadow root 内 `--primary-color` 解析为 `#b23a2e`，齿轮按钮拿到纸底 `#fbf8f0` 与 hairline `#d8d0be`
- **合并 `SettingsPanel` 与 `popup`**：这是本次唯一超出纯视觉的结构调整。两份代码 95% 逐行相同，不合并就要把同一套新样式写两遍，且以后必然改一处忘一处
- **注入页面的译文样式写字面值而非 token**：译文注入的是任意第三方页面，拿不到扩展的 CSS 变量。已在 `style.ts` 顶部注释说明这些字面值需与 theme.scss 同步
- **图标放弃内嵌白框**：印面内框在 512px 下好看，但缩到 16px 工具栏尺寸时会吃掉约 20% 面积并产生与外轮廓竞争的第二道边，实测无内框版本在 16/24px 下明显更清晰

**验证**：`pnpm check` 通过（typecheck + lint 0 error + format:check + cspell 0 issue + hotlink-rules）。`pnpm dev` 产物经本地静态服务器 + `chrome.*` API shim 在 Chrome 实机走查：

- options 四个分类在 1280 / 768 / 375（设备模拟）三个宽度逐个切换，确认书脊导航正确降级、双栏正确堆叠、无横向溢出
- 键盘 Tab 实测（非脚本 `.focus()`，后者不触发 `:focus-visible`）确认朱砂焦点环清晰可见
- 悬浮球在真实页面的 Shadow DOM 内验证 token 解析、齿轮按钮样式、tooltip、点击切换翻译后进入「已落印」态（墨渍动画 + 石青角标）
- popup、侧边栏逐个截图确认
- 6 种译文样式在浅色与深色两种宿主页面上分别渲染，确认互相可区分且都可读

**未验证**（如实记录）：划词翻译面板与图片翻译按钮的最终视觉、错误弹窗（`createTranslationErrorUI`）的最终视觉，这三处只做了颜色字面值替换并经代码检查，未在实机触发；真实 LLM 翻译链路未跑通（无可用 API Key），因此译文注入到真实网页后的效果未端到端验证。

---

### 2026-08-13 — 全局 UI 圆角统一

**修改内容**：

- `src/styles/theme.scss`：将圆角 token 统一为 `6 / 8 / 12 / 16px`，并保留 `9999px` 功能性圆形
- 设置页、popup、侧边栏及网页注入 UI：按控件、卡片、浮层语义统一圆角，补齐状态标记、弹窗、Toast 和调试面板
- 划词翻译与图片翻译的 Shadow DOM 入口显式引入主题；直接注入宿主网页的样式使用固定圆角值，避免受宿主 CSS 变量影响
- 新增 `test/test-ui-radius.mjs` 静态契约测试，校验圆角尺度、Shadow DOM 主题引入和宿主页注入样式

**原因**：将项目中的近方/直角视觉统一升级为适中圆角，同时保留 loading spinner、状态点和拼接控件内部接缝等必要形状。

---

### 2026-08-14 — 构建框架迁移到 WXT

**修改内容**：

- 将 Plasmo 入口、Manifest、Shadow DOM 内容脚本迁移为 WXT entrypoints
- 消息层迁移到 `@webext-core/messaging`，Storage 适配迁移到 WXT Storage
- 构建、打包、CRX、CI、环境变量、静态资源与项目文档改用 WXT 约定
- 依赖升级到 WXT 0.21.4、Vite 8.2.1，并移除 Plasmo 依赖

**验证**：`pnpm check`、消息/RPC 测试、完整生产构建和 CRX 打包均通过；生成的 MV3 Manifest 权限与迁移前一致。

---

### 2026-08-14 — 初始化默认使用 Google Translate

**修改内容**：

- 新安装默认选择 `google-translate`；保留现有可用 AI 模型选择，无可用模型时自动回退并持久化 Google Translate
- 新增 Google Translate 后台表单请求、响应解析、最长 30 秒超时和统一中断支持
- 设置页与 popup 将“翻译模型”统一为“翻译服务”，固定显示 Google Translate 和已配置可用的 AI 模型
- 划词翻译读取配置的目标语言，不再固定翻译为中文
- 新增 `pnpm test:google` 并纳入 `pnpm check`，覆盖默认选择、旧配置迁移持久化、请求参数、响应解析、HTTP 错误、超时/取消及管理器服务分类

**注意**：默认通道使用 Google 网页端非公开接口，待翻译文本会发送到 Google；失败时明确报错，不静默切换服务。

---

### 2026-08-15 — 启动并修复划词翻译

**修改内容**：

- 移除划词组件入口的无条件空渲染，新安装默认选中文本后直接翻译，并恢复 options 中的完整划词设置入口
- 使用事件 `composedPath()` 区分 Shadow DOM 内部交互与页面外点击，避免圆点、面板和关闭按钮被误关闭
- 增加空选区、可选完成回调和视口边缘定位保护，窄屏面板宽度自动收缩
- 新增 `pnpm test:selection` 并纳入 `pnpm check`，同时启用 ESLint `no-unreachable` 防止同类禁用回归

**兼容性**：只改变新安装默认触发方式；已有用户持久化的划词触发配置保持不变。

---

### 2026-08-29 — 划词翻译新增 AI 概念解释

**修改内容**：

- `src/components/TranslateTextPanel/index.tsx`、`src/contents/selectionTranslate.tsx`：划词翻译面板新增按需触发的“解释概念”操作；翻译结果始终保留，解释区域提供独立的加载、失败、重新解释状态，并标注“AI 生成，未联网核验”；加载、成功和失败状态变化时会重新计算面板位置，底层异常统一转换为安全提示
- `src/utils/dom.ts`、`src/hooks/useSelectionTranslate.ts`：从选区最近的可读块提取邻近语境，通过真实 DOM Range 定位本次选中的同名词位置，规范化空白并围绕该位置截断到最多 500 字，用于区分同名人物和多义专有名词
- `src/translation/modelTranslation.ts`、`src/translation/translationService.ts`：新增概念解释提示词和模型路由；优先使用当前有效的生成式 AI 模型，当前为 Google Translate、DeepL 或 DeepLX 时回退到第一个已启用且配置完整的 LLM；候选扫描会安全跳过历史遗留的未知 provider 与运行时字段异常的配置；没有可用模型时返回明确错误，并在请求发送边界再次将语境限制为 500 字
- 解释提示词将选中文本、页面标题和邻近语境作为转义后的 XML 数据传入，要求按“类别、简释、背景、语境”输出，遇到歧义或信息不足时明确说明
- `src/background/messages/model-gateway.ts`：同步修正 DeepSeek 和 Moonshot 的请求兼容性，不再注入火山引擎专属的 `thinking` 参数；Huoshan 原有能力保持不变
- `test/translation-service.test.ts`、`test/model-gateway.test.ts`、`test/test-selection-translate.ts`、`test/test-selection-translate-hook.tsx`、`test/selection-explanation-panel.test.tsx`：新增模型选择与有效性、不可用模型、提示词边界、上下文截断与同名词定位、provider 参数兼容性和面板完整状态流测试，并纳入 `pnpm test:selection`

**原因**：用户希望划词选中历史事件、人物或专有名词时，不仅能获得翻译，还能按需查看简洁的背景解释；显式点击可避免普通划词产生额外 AI 请求、延迟和费用。

**验证**：`pnpm check` 通过（typecheck、lint 0 error、format:check、hotlink-rules、cspell、Google、划词交互脚本、22 项划词服务/网关测试、4 项面板测试及 175 项图片翻译测试）。

### 2026-09-02 — 开发与生产环境持久化存储隔离

**修改内容**：

- `src/constants/storage.ts`：新增集中式持久化命名规则，development 构建统一追加 `-dev`，production 与 test 保持原名
- `src/state/util.ts`、`src/background/messages/structured-image-translation.ts`：隔离扩展配置、access token 与 refresh token 的 Chrome local storage 键
- `src/translation/cache/L2PersistentCache.ts`、`src/translation/cache/TranslationCacheFactory.ts`：development 构建使用 `translation-cache-db-dev` IndexedDB 数据库
- `src/translation/PictureCache.ts`、`src/model-management/discovery.ts`：隔离图片翻译缓存及模型目录缓存命名空间
- `test/storage-names.test.ts`：新增 development、production、test 模式命名回归测试，并纳入 `test:image` 门禁
- `scripts/sync-hotlink-sites-from-immersive.cjs`：修正生成文本与 Prettier 的稳定格式差异，避免格式化后 `check:hotlink-rules` 误判生成文件过期

**原因**：避免本地开发版与正式发布版在同一浏览器配置中共享 IndexedDB、扩展配置、令牌及持久化缓存，防止开发调试数据污染正式环境。

---

### 2026-09-03 — extension-config 增加 Zod 字段级修复

**修改内容**：

- `src/types/extensionConfigSchema.ts`：按当前 `ExtensionConfig` 与 `BaseModel` 结构重建 Zod schema；新增字段级配置修复和模型列表逐条过滤，未知字段会被剥离，异常字段回退默认值
- `src/state/translationService.ts`：在配置读取、写入和订阅边界统一执行校验、旧模型迁移及当前模型归一化；修复后的配置自动写回 Chrome local storage
- `src/background/messages/structured-image-translation.ts`：图片翻译后台直接读取配置时校验 `aiModelList`，防止损坏模型数据进入执行流程
- `test/extension-config-validation.test.ts`、`test/background-image-translation.test.ts`：新增损坏字段、非对象配置、异常模型、写回修复、写入防护及旧 `endpoint` 迁移兼容性测试，并纳入 `test:image`

**原因**：防止 Chrome local storage 中的缺失字段、错误类型、非法枚举或损坏模型配置导致插件初始化及翻译流程异常，同时尽可能保留合法用户设置和 API Key。

---

### 2026-09-03 — 页面翻译缓存绑定角色与模型

**修改内容**：

- `src/translation/ImmersiveTranslator.ts`：页面翻译缓存读取与写入不再使用固定角色 `"translator"`，改为使用当前 `translationRuntimeConfig.aiRole`；模型维度继续使用当前 `currentModel`
- `test/page-translation-cache-role.test.ts`：新增缓存维度回归测试，确保读写两端同时绑定当前 AI 角色和模型，并纳入 `test:image`

**原因**：相同文本在不同 AI 角色或不同模型下可能产生不同译文，缓存键必须同时包含当前角色与模型，避免切换配置后复用不匹配的页面翻译结果。

---

### 2026-09-02 — Chrome Web Store OIDC 自动发布

**修改内容**：

- `.github/workflows/release.yml`：现有 `main` 发版流水线新增 GitHub OIDC 认证，通过 `google-github-actions/auth` 获取 15 分钟短期 access token；所有第三方 Actions 固定到完整 commit SHA。新版本先将 ZIP、CRX、`SHA256SUMS` 封装为单一 recovery bundle 保存到 draft GitHub Release，再上传同一 ZIP 到 Chrome Web Store；中途失败时仅允许原提交复用并校验 bundle，商店提交成功后才发布 GitHub pre-release
- `scripts/chrome-web-store.cjs`：新增 Chrome Web Store API V2 发布客户端，支持 ZIP 根目录 manifest 版本校验、Chrome 版本比较、多渠道高版本保护、异步上传轮询、30 秒请求超时、重复发布幂等处理、STAGED 发布恢复、发布结果状态校验以及下架/警告失败关闭
- `test/chrome-web-store-publish.test.cjs`、`package.json`、`pnpm-lock.yaml`：新增 26 项发布客户端、工作流、安全边界和恢复流程测试，通过 `pnpm test:chrome-web-store` 运行并纳入 `pnpm check`；新增 `fflate` 用于读取 ZIP manifest
- `docs/chrome-web-store-automation.md`：新增 Chrome Web Store Service Account、Google Cloud Workload Identity Federation、不可变 GitHub repository/owner 数字 ID、所需 API、GitHub Actions Variables 和故障恢复配置说明
- `.gitignore`、`.env.local`：新增 `.env.local` 忽略规则并停止 Git 跟踪，本机文件继续保留；发布认证不使用 Google JSON 私钥

**原因**：用户希望每次升级 `package.json.version` 并推送到 `main` 后，自动上传 Chrome Web Store、提交审核并在审核通过后更新扩展，同时确保公开仓库不暴露发布凭据或因重跑产生同版本不同安装包。

**验证**：`pnpm check` 通过（typecheck、lint 0 error、format:check、hotlink-rules、cspell、Google、划词测试、26 项 Chrome Web Store 自动发布测试及 179 项图片/存储测试）；独立代码复核未发现 Critical 或 Important 问题。公开仓库扫描未发现真实私钥或常见令牌特征，`.env.local` 历史仅 1 个版本且没有凭据值。

---

### 2026-09-03 — 翻译按钮新增当前页缓存刷新

**修改内容**：

- `src/contents/TranslationControlCenter.tsx`：页面翻译完成或进行中时，悬停翻译按钮显示刷新入口；点击后按“终止任务、精确清除当前页缓存、移除旧译文、重新翻译”的顺序执行，并提供成功或失败提示
- `src/translation/ImmersiveTranslator.ts`：新增当前页面翻译缓存清理接口，按当前源语言、目标语言、模型和 AI 角色生成唯一缓存键，并在删除前等待翻译请求终止
- `src/translation/cache/TieredTranslationCache.ts`：新增批量精确删除能力，同时清理 L1 内存缓存与 L2 IndexedDB 缓存
- `test/page-translation-cache-refresh.test.ts`、`test/page-translation-cache-refresh-ui.test.tsx`：新增缓存范围、活动模型/角色、操作顺序、删除失败及重翻无结果等回归测试；同步扩展 `test/page-translation-cache-role.test.ts` 的清理路径约束，并纳入 `test:image`

**原因**：方便用户在页面译文过期或翻译配置变化时，一键绕过当前页旧缓存并重新获取译文，同时避免误清空其他文本、模型或 AI 角色的缓存。

**验证**：`pnpm check` 通过（typecheck、lint 0 error、format:check、hotlink-rules、cspell、Google、划词测试、26 项 Chrome Web Store 自动发布测试及 191 项页面/图片/存储测试）。

---

### 2026-09-07 — 图片翻译支持独立选择模型平台与模型

**修改内容**：

- `src/utils/visionModels.ts`：新增可用视觉模型平台去重、平台内模型过滤和当前平台推导；仍只接受已启用、API Key 非空且声明视觉能力的模型
- `src/options/Image.tsx`：图片翻译设置新增“模型平台”与“视觉模型”级联选择；切换平台时自动选择该平台第一个可用视觉模型，已有图片模型可反推出对应平台
- 图片翻译继续仅持久化 `imageTranslationModelId`，不新增平台配置字段，也不修改文本翻译的 `currentModel`、图片翻译消息协议或后台调用链
- `test/vision-models.test.ts`、`test/image-settings-ui.test.tsx`：新增平台过滤、平台推导、Google Translate 文本服务独立性、平台切换和空状态回归测试；同步将配置持久化测试的旧 `local:` 断言更新为当前 `sync:` 契约
- `docs/superpowers/specs/2026-09-07-image-translation-model-platform-design.md`、`docs/superpowers/plans/2026-09-07-image-translation-model-platform.md`：记录确认后的设计和 TDD 实施步骤

**原因**：图片翻译需要独立于网页文本翻译服务选择模型平台和对应视觉模型，尤其是在文本使用 Google Translate 时仍可调用用户配置的多模态 AI 模型。

**验证**：`pnpm check` 通过（typecheck、lint 0 error、format:check、hotlink-rules、cspell、Google、划词测试、26 项 Chrome Web Store 自动发布测试及 196 项页面/图片/存储测试）。

---

### 2026-09-07 — 扩展产品版本统一读取 package.json

**修改内容**：

- `src/constants/options.ts`：`EXTENSION_INFO.version` 不再硬编码，改为读取 `package.json.version` 并保留界面展示用的 `v` 前缀
- `test/extension-version.test.ts`、`package.json`：新增产品版本单一来源回归测试并纳入 `pnpm test:image`，后续升级 `package.json.version` 时会同步校验设置页展示版本
- `README.md`、`design-preview/theme-*.html`：移除容易过期的静态产品版本号，改为指向 `package.json.version` 或明确标注 `package.json` 版本来源
- Canvas Hook 协议、IndexedDB 和图片缓存 schema 等内部兼容版本保持独立，不随扩展产品版本自动变化

**原因**：消除设置页版本号与发布版本不一致的问题，使扩展产品版本只需在 `package.json` 中维护一次。

**验证**：`pnpm check` 通过（typecheck、lint 0 error、format:check、hotlink-rules、cspell、Google、划词测试、26 项 Chrome Web Store 自动发布测试及 197 项页面/图片/存储/版本测试）。

---

### 2026-09-08 — 支持阿里百炼 Token Plan

**修改内容**：

- `src/model-management/providers.ts`、`src/types/aiModel.ts`、`src/types/extensionConfigSchema.ts`：增加官方端点档案和存储字段，兼容按量付费、Token Plan 中国站/国际站及自定义地址
- `src/model-management/discovery.ts`、`src/background/messages/model-gateway.ts`：统一按通道路由模型发现、文本和视觉请求，Token Plan 发现失败不回退按量付费公共目录
- `src/options/BailianOfficialEndpointFields.tsx`、`src/options/TranslateServices.tsx`：增加官方通道选择、区域 URL 展示、Key 提示、视觉能力声明和使用范围提示
- 相关测试：覆盖端点解析、配置兼容、模型发现、网关错误和设置页交互

**原因**：阿里百炼 Token Plan 使用独立 API Key 和 Base URL，需要同时支持中国站与国际站，并避免与按量付费通道错配。

---

### 2026-09-08 — 加固 Token Plan 发现与设置页恢复能力

**修改内容**：

- `src/model-management/discovery.ts`：远程模型发现结果在合并前校验为数组；Token Plan 收到缺失或畸形成功响应时作为失败处理，绝不展示按量付费公共目录；合法空列表保持为空
- `src/options/BailianOfficialEndpointFields.tsx`、`src/options/TranslateServices.tsx`：未知官方通道不再导致设置页崩溃，改为显示安全配置错误并保留重新选择通道或切换自定义地址的能力；自定义模式忽略残留无效官方通道 ID
- `src/image-translation/providers.ts`：视觉错误提示改为根据模型端点选择判断 Token Plan，不再相信服务端错误文案中的通道词；Token Plan 风险提示补充浏览器翻译扩展可能属于不支持的自定义应用、订阅暂停或 Key 封禁风险
- `test/`：新增畸形发现响应、空列表、无效通道恢复、父级配置更新、地址切换与 Key/模型名保留、错误文案不可信等回归覆盖

**原因**：避免异常服务端响应、旧配置残留或不可信错误文本导致 Token Plan 错误回退、设置页不可恢复或通道提示被误判。

### 2026-09-09 — 合并百炼 Token Plan 支持到 main

**修改内容**：将 `codex/bailian-token-plan` 分支合并到 `main`，包含官方通道选择、文本与视觉路由、严格模型发现和异常配置恢复。

**原因**：让主工作目录包含已验证的 Token Plan 功能。合并后的 `pnpm check` 通过；原有未提交改动保留。

---

### 2026-09-09 — 图片翻译独立选择服务配置和视觉模型

**修改内容**：图片设置页改为选择已配置的 AI 服务实例，再通过共享模型发现逻辑选择具体视觉模型；新增 `imageTranslationModelName` 持久化与旧配置迁移，明确区分缺失字段和主动清空。后台从同步配置读取凭据，以内存副本调用独立视觉模型，并按服务与模型组合隔离缓存。内容脚本在选择变化时撤销旧任务和覆盖层。补充配置、发现、设置页、后台、缓存与内容脚本测试，修正测试环境的 WXT 模块解析。

**原因**：允许图片翻译复用翻译服务的平台凭据，同时独立选择视觉模型，不影响文本翻译模型。

**验证**：`pnpm format` 已执行；`pnpm check` 全部通过，包括 213 项图片/页面/配置测试、26 项商店发布测试以及 Google 和划词测试。尚未使用真实服务凭据执行收费图片翻译。

---

### 2026-09-09 — 按时间顺序合并全部本地功能分支到 main

**修改内容**：按各未合并分支最后提交时间，将 `codex/token-usage-statistics`、`codex/image-translation-remote-model-selection` 和 `codex/page-summary-toggle-rendering` 合并到 `main`；确认此前的 `codex/bailian-token-plan` 也已包含在主分支。冲突解决时保留 Token 用量统计、百炼 Token Plan、图片具体视觉模型选择、页面总结配置与渲染，并让共享模型发现逻辑继续传递 `officialEndpointId`。补齐页面总结网关请求的 `feature: "page-summary"`，将页面总结测试纳入 `test:image`，并补充 DOM 测试所需的 `jsdom` 环境声明。

**原因**：统一所有本地功能分支的提交历史和实现，使 `main` 成为当前完整集成分支，同时保留合并前未提交的工作区改动。

**验证**：`pnpm format` 与 `pnpm check` 均通过；全量检查包含 typecheck、lint（0 error）、Prettier、hotlink-rules、cspell、Google 翻译、划词翻译、26 项 Chrome Web Store 测试及 249 项图片/页面/配置测试。

---

### 2026-09-09 — 新增页面总结设置开关

**修改内容**：

- `src/types/config.ts`、`src/types/extensionConfigSchema.ts`、`src/state/constants.ts`：新增 `enablePageSummary` 与 `pageSummaryDisabledSites` 配置，默认关闭页面总结
- `src/options/Basic.tsx`、`src/components/SettingsPanel/index.tsx`：新增独立的“自动总结页面”开关、隐私提示和无可用生成式模型提示
- `src/utils/pageSummary.ts`、`src/translation/translationService.ts`：统一生成式模型可用性判断和页面总结模型回退选择，排除 `DEEPL`/`DEEPLX`
- `test/`：新增配置、设置页和模型可用性回归测试

**原因**：让页面总结功能在设置页可见且可控，避免将翻译专用模型误判为可生成总结的模型。

---

### 2026-09-09 — 清理已合并到 main 的本地功能分支

**修改内容**：逐一验证以下分支均为 `main` 的祖先，没有遗漏的分支提交，使用 `git branch -d` 删除分支名：

- `codex/bailian-token-plan`：`ac161096de69c7fac13ff2b5881acb508952f13c`
- `codex/image-translation-remote-model-selection`：`594bcc63a62e202c3313f2df3977bebaf5897139`
- `codex/page-summary-toggle-rendering`：`48035bc649ba8b7c3a5875b5f7c14211ef99611b`
- `codex/token-usage-statistics`：`dfda213114f822c6c4cce89bef5082e67975de14`

各关联 worktree 在原提交上切换为 detached HEAD，目录及未提交文件全部保留；操作前后对未提交文件计算 SHA256，确认内容未变。主工作区的未提交改动保持原样；本次没有推送或删除远程分支。需要恢复分支名时，可从上述提交重新创建。

**原因**：按用户要求将全部本地分支收拢到 `main` 并清理已合并分支。相关提交此前已全部合入 `main`，无需重复生成合并提交。

**验证**：当前 `main` 工作区执行 `pnpm check`，退出码为 0；包含 249 项图片/页面/配置测试、36 项翻译服务/概念解释测试、26 项商店测试及 Google 和划词交互检查。lint 为 0 errors、25 条既有 warnings；清理后本地仅剩 `main`，`git branch --no-merged main` 输出为空。

---

### 2026-09-09 — 划词概念解释支持基础 Markdown 渲染

**修改内容**：

- `package.json`、`pnpm-lock.yaml`：新增 `react-markdown@^10` 运行时依赖。
- `src/components/TranslateTextPanel/index.tsx`：仅将概念解释结果改为基础 Markdown 渲染，支持标题、强调、列表、引用、代码和链接；设置局部排版、长代码横向滚动、危险链接过滤、原始 HTML 跳过及图片替代文本展示；保留翻译、加载、错误、重试和定位回调行为。
- `test/selection-explanation-panel.test.tsx`：补充 Markdown DOM、链接安全、原始 HTML、图片替代文本和重新解释布局回归测试。

**原因**：让划词解释结果保留模型输出的层次结构，提高长文本解释的可读性，同时避免远程图片、原始 HTML 和不安全链接影响页面。

**验证**：`pnpm check` 与 `pnpm exec wxt build` 均通过；`pnpm check` 包含 11 项概念解释面板测试、32 项翻译服务/网关测试、26 项商店测试及 249 项图片/页面/配置测试，lint 为 0 errors、25 条既有 warnings。

---

### 2026-09-09 — 稳定划词概念解释的 Markdown 输出格式

**修改内容**：更新 `src/translation/modelTranslation.ts` 的概念解释系统提示词，要求模型固定使用四个二级标题输出基础 Markdown，禁止 HTML、XML、JSON、代码围栏、表格、脚注、数学公式和图片；在 `test/translation-service.test.ts` 增加提示词约束回归断言。

**原因**：统一模型返回结构，降低不同模型输出格式波动，确保与划词解释面板的基础 Markdown 渲染能力匹配。

**验证**：`pnpm check` 全部通过。

### 2026-09-09 — 修复服务错误残留、图片开关覆盖并调整总结弹窗

**修改内容**：

- `src/options/TranslateServices.tsx`、`src/components/ApiKeyInput/index.tsx`：按服务隔离输入组件状态，密钥改变时清空测试结果，并忽略已过期的异步测试结果。
- `src/state/config.ts`：同一状态容器内串行处理配置和模型更新，等待持久化完成，避免连续更新使用旧快照覆盖图片翻译开关；模型更新返回最新模型列表。
- `src/page-summary/PageSummaryRenderer.ts`、`src/page-summary/PageSummaryController.ts`：总结改为底部居中半透明按钮打开原生弹窗，悬浮显示红色关闭按钮，可暂时隐藏至刷新页面；保留加载和错误状态，并安全处理卸载后的请求返回。
- `test/extension-config-validation.test.ts`、`test/model-discovery.test.tsx`、`test/page-summary-renderer.test.ts`：补充并发更新持久化、错误状态隔离和弹窗交互回归测试。

**原因**：修复切换服务后错误残留及配置写入竞争导致图片开关丢失，使页面总结按需展示且不占正文空间。

**验证**：执行 `pnpm format`；设置进程环境变量 `VITEST_MAX_WORKERS=2` 后 `pnpm check` 全部通过，图片、页面与配置组 252 项测试通过。默认高并发曾导致 UI 测试超时，降低并发后通过；尚未进行真实扩展页面的视觉验收。

### 2026-09-09 — 优化翻译按钮吸边交互与总结帮助图标

**修改内容**：`src/options/Basic.tsx` 将未设置样式的问号按钮替换为统一帮助图标，调整开关与图标对齐；`src/contents/TranslationControlCenter.tsx` 将主翻译按钮默认透明度设为 0.5，按左右侧向外偏移自身宽度的一半，悬浮与键盘聚焦时展开，支持键盘操作；`src/hooks/useDrag.ts` 重构拖拽坐标和左右吸边，限制拖拽起点为主按钮，处理窗口缩放并为上下操作入口预留空间；`test/model-discovery.test.tsx` 补充真实拖拽 hook 回归验证。

**原因**：减少悬浮翻译按钮对网页内容的遮挡，修复自动总结开关旁问号按钮样式异常，并防止普通页面点击改变悬浮按钮位置。

**验证**：执行 `pnpm format`；进程环境变量 `VITEST_MAX_WORKERS=2` 下 `pnpm check` 全部通过，图片、页面与配置组 253 项测试通过。未执行真实浏览器视觉验收。

### 2026-09-10 — 应用「晴空来信」蓝白二次元 UI

**修改内容**：新增 `src/components/SkyArtwork/` 与 `src/public/assets/sky-letter/`，为 Options、popup、sidepanel、划词翻译、图片翻译和页面总结统一接入天空蓝、纸面、邮局插画和澄羽装饰；调整设置导航、页头、分节、翻译入口、提示层和翻译控件的主题 token 与响应式样式；补充 `docs/ui-previews/`、`docs/superpowers/plans/2026-09-10-sky-letter-ui.md` 及 skill 资源说明。

**原因**：将确认后的蓝白二次元提示词落到扩展四个入口，统一品牌视觉，同时保留既有翻译、配置、拖拽和状态交互。

**验证**：`pnpm format`、`VITEST_MAX_WORKERS=2` 下的 `pnpm check` 和 `pnpm build` 通过；生产构建包含本地插画资源。本轮未进行浏览器视觉验收。

### 2026-09-10 — 修复初始化入口加载不存在的样式文件

**修改内容**：`src/entrypoints/initialize.content.tsx` 将 `cssInjectionMode` 从 `ui` 改为 `manual`，保留初始化组件和 Shadow DOM，停止请求未生成的 `content-scripts/initialize.css`。

**原因**：初始化入口没有导入样式，WXT 不生成对应 CSS；启用自动 UI 样式加载会触发 Chrome 的资源访问拒绝报错。

**验证**：`pnpm format`、`VITEST_MAX_WORKERS=2` 下的 `pnpm check` 和 `pnpm exec wxt build` 均通过；确认构建产物的初始化入口使用 `cssInjectionMode: manual`。

### 2026-09-10 — popup 添加晴空邮局二次元背景

**修改内容**：`src/components/SettingsPanel/index.tsx` 为 `embedded` 变体加入本地邮局插画、渐变文字遮罩与澄羽半身头像，设置列表和语言区域使用浅色纸面卡片并收紧行距；装饰层禁止点击且单独裁切，保留真实配置读写，并补齐开关与下拉框的无障碍名称。`src/styles/popup.scss` 保持 320px 宽度，增加 600px 高度上限和纵向滚动；`src/components/SkyArtwork/index.tsx`、`src/popup/index.tsx` 同步入口说明。

**原因**：按用户要求让 popup 展示蓝白二次元图片背景，同时保证文字和控件清晰、底部操作可达，复用扩展内图片以支持离线显示。

**验证**：`pnpm format`、`VITEST_MAX_WORKERS=2` 下的 `pnpm check` 和 `pnpm build` 通过；生产包包含两张本地插画。完成背景层级与共享组件的只读复核，本轮未进行浏览器视觉验收。

### 2026-09-10 — popup 玻璃卡片提高透亮度

**修改内容**：`src/components/SettingsPanel/index.tsx` 将 popup 卡片、语言区域和高级设置按钮调整为更低不透明度的白蓝玻璃渐变，增加 `backdrop-filter` 模糊、饱和度与亮度，并让下拉框底色同步变轻；保留高对比度和减少透明度时的回退样式。

**原因**：根据用户反馈，让二次元邮局背景更自然地透过 popup 卡片，同时保持设置文字和交互控件清晰。

**验证**：`pnpm format`、`VITEST_MAX_WORKERS=2` 下的 `pnpm check` 和 `pnpm build` 通过；生产包包含更新后的 popup 样式。本轮未进行浏览器视觉验收。

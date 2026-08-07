# CLAUDE.md — mewCat (译趣喵) 项目文档

> **维护规则**：每次对项目做出修改后，必须执行 `pnpm check` 进行全量检查，确认无报错后，再在本文件末尾的 [修改记录](#修改记录) 章节追加一条记录，格式见该章节说明。

> **格式规则**：所有代码修改必须符合 Prettier 格式规范。修改 `src/` 下的文件后，必须执行 `pnpm format` 确保格式一致。Claude Code 已配置 PostToolUse hook，会在每次文件写入/编辑后自动执行 `pnpm format`。

> **功能开发规则**：实现任何新功能前，必须按以下顺序完成分析，经用户确认后再动手编码：
> 1. **需求可行性分析** — 明确需求边界、约束条件（MV3 限制、CSP、跨域等），判断是否可行及潜在风险
> 2. **技术选型** — 列出可选方案及各自的优缺点，给出推荐选项和理由
> 3. **技术落地方案** — 描述具体实现路径：涉及哪些文件、新增/修改哪些模块、数据流如何变化
> 4. **用户确认** — 将以上分析呈现给用户，等待明确同意后再开始实现

---

## 项目概述

**名称**：mewCat（译趣喵）  
**类型**：Chrome MV3 浏览器扩展  
**框架**：Plasmo 0.90.5  
**语言**：TypeScript 5.9.2  
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
├── hooks/               # React Hooks
└── config/              # 构建时配置（mewCat 页面 URL）
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

| Atom | 文件 | 说明 |
|------|------|------|
| `configAtom` | state/config.ts | 主配置，持久化到 Chrome local storage |
| `updateConfigAtom` | state/config.ts | 更新配置的写入 atom |
| `userAtom` | state/user.ts | 用户信息（头像、手机号等） |
| `accessTokenAtom` | state/user.ts | 访问 token，持久化 |
| `refreshTokenAtom` | state/user.ts | 刷新 token，持久化 |
| `fetchUserAtom` | state/user.ts | 触发拉取用户信息 |
| `setAccessTokenAtom` | state/user.ts | 设置 token 并同步到请求头 |

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

| 标识符 | 用途 |
|--------|------|
| `mewcat-container` | 翻译结果容器 |
| `mewcat-wrapper` | 翻译文本包装 |
| `mewcat-error-container` | 错误提示容器 |
| `mewcat-error-modal` | 错误详情弹窗 |
| `mewcat-retry-btn` | 重试按钮 |
| `data-mewcat-parent-node-id` | 翻译节点唯一 ID |
| `data-mewcat-canvas-id` | Canvas 元素 ID |
| `mewcat-canvas-hook` | Canvas Hook 通信频道 |
| `__mewCatCanvasHookState__` | Window 上的 Hook 状态标记 |

---

## 关键配置

### 默认扩展配置（src/state/constants.ts）

```typescript
{
  isSelectedTranslate: true,
  targetLanguage: "zh-CN",
  currentModel: "SYSTEM",
  enableGoogleTranslate: true,
  enableMicrosoftTranslate: true,
  maxRequestsPerSecond: 3,
  maxTextLengthPerRequest: 1024,
  selectionTriggerMode: "shift",
  cacheEnabled: true,
  enableThinking: false,
  enableContext: false,
  enableImageTranslateButton: false
}
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PLASMO_PUBLIC_ENABLE_CANVAS_REBUILD` | 是否启用 canvas 重建 | `"true"` |
| `PLASMO_PUBLIC_CANVAS_ROLLOUT_PERCENT` | canvas 功能灰度百分比 | `"100"` |

两者都在 `src/background/config/canvas-sites.ts` 内有代码级默认值，**构建不需要 `.env` 文件，也不需要任何 secret**。

> 注：早期文档中记载的 `PLASMO_PUBLIC_DOC2X_API_DOMAIN` 已随 SYSTEM 平台一并移除，`src/` 中不再有任何引用。

---

## 构建与开发

```bash
pnpm dev          # 开发模式（热重载）
pnpm build        # 生产构建（Plasmo → 混淆 → ZIP）
pnpm typecheck    # TypeScript 检查
pnpm lint         # ESLint
pnpm format       # Prettier 格式化
pnpm check        # 全量检查
pnpm package      # 打包为带日期的 ZIP
pnpm crx          # 打包签名 .crx（需 key.pem 或 CRX_PRIVATE_KEY）
```

**构建流程**：`plasmo build` → `scripts/obfuscate.js`（JS 混淆）→ `scripts/package-with-date.js`（ZIP 打包）

---

## CI / 自动发布

`.github/workflows/release.yml`：push 到 `main` 时自动执行。

**流程**：`pnpm install --frozen-lockfile` → **`pnpm check`（门禁，失败即中止）** → 读取 `package.json` 的 `version` → 若 tag `v{version}` 不存在则 `pnpm build` + `pnpm crx` → `gh release create` 创建 pre-release 并上传 `mewcat-v{version}.zip` 和 `mewcat-v{version}.crx`。

**发版方式**：手动 bump `package.json` 的 `version` 并推到 `main`。不改 version 的 push 只跑检查和构建校验，不产出 Release。发布判据是「tag 是否已存在」，因此对 squash merge、重复 push、workflow 重跑都是幂等的。

**依赖的仓库配置**：
- Settings → Actions → General → Workflow permissions 设为 **Read and write permissions**
- Secret `CRX_PRIVATE_KEY_B64`：crx 签名私钥的 base64，由 `node scripts/gen-crx-key.js` 生成

**关于 crx 私钥**：扩展 ID 由私钥推导，必须固定。`key.pem` 已被 `.gitignore` 排除，丢失后无法恢复，已通过 crx 安装的用户将收不到更新。

---

## Manifest 权限

```json
{
  "host_permissions": ["<all_urls>", "http://*/*", "https://*/*", "https://v2c.doc2x.noedgeai.com/*"],
  "permissions": ["storage", "tabs", "scripting", "windows", "contextMenus", "declarativeNetRequest", "declarativeNetRequestWithHostAccess"]
}
```

---

## 修改记录

> **格式**：每次修改后在此追加，格式如下：
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
- `.claude/settings.json`：新增 PostToolUse hook，在每次 Write/Edit `src/` 文件后自动执行 `pnpm format`
- `CLAUDE.md`：新增格式规则说明

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
- `CLAUDE.md`：新增「CI / 自动发布」章节；「环境变量」表勘误（原记载的 `PLASMO_PUBLIC_DOC2X_API_DOMAIN` 已无任何代码引用，实际生效的是 `PLASMO_PUBLIC_ENABLE_CANVAS_REBUILD` 和 `PLASMO_PUBLIC_CANVAS_ROLLOUT_PERCENT`，二者均有代码级默认值）；AI 模型系统章节的平台枚举与 `BaseModel` 结构同步 2026-05-21 的改动（移除已删除的 `SYSTEM` / `isSystem` / `modelVersion`，补充 `isOfficial`）

**原因**：此前发版全靠人工在本地跑 `pnpm build` 再手动上传产物，容易漏跑质量检查，也没有可追溯的版本记录。

几个设计选择的理由：
- **发布判据用「tag 是否已存在」而非 diff `HEAD~1` 的 package.json**：前者对 squash merge、同版本多次 push、workflow 重跑都是幂等的，后者在这些场景下会误判
- **crx 私钥必须固定且不能静默生成**：扩展 ID 由私钥推导，随机密钥意味着每次发布都是一个「新扩展」，已安装用户永远收不到更新。原脚本在无 `key.pem` 时静默生成随机密钥，属于会悄悄产出错误结果的缺陷，故改为硬失败
- **私钥以 base64 存 Secret**：避免多行 PEM 在 secret 注入时被换行符处理影响
- **用 runner 预装的 `gh` CLI 而非第三方 release action**：减少供应链攻击面
- **升级 `crx` 到 5.0.1**：3.0.1 的 `loadContents()` 依赖 archiver 的 `readable` 事件累积 Buffer，在当前 Node 22 下会读到 `null` 导致 `Cannot read properties of null`；5.0.1 重写了该实现，且默认产出 CRX3 格式（3.0.1 产出的是 Chrome 已废弃的 CRX2）。npm 上 `crx` 全系列已标记 deprecated，但仍是可用的方案，后续如遇问题可迁移到 `crx3` 包

**验证**：本地已验证 —— 构建产物解压抽查确认 JS 已混淆（`plasmo package` 不会覆盖 `obfuscate.js` 的就地修改）；crx 产出文件魔数为 `Cr24` + 版本字节 `03`（CRX3）；删除 `key.pem` 后 `pnpm crx` 报错且退出码为 1；base64 → 环境变量的 CI 路径打包成功；`git check-ignore` 确认 `key.pem` 不会被提交；`pnpm check` 通过。CI 端待用户配置好 Actions 写权限和 `CRX_PRIVATE_KEY_B64` Secret 后首次 push 验证。



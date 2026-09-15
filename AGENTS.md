# AGENTS.md — mewCat (译趣喵) 项目文档

> **格式规则**：所有代码修改必须符合 Prettier 格式规范。修改 `src/` 下的文件后，执行 `pnpm format` 确保格式一致。

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

> 本文中的应用路径均相对于 `apps/extension`。本地环境变量统一读取根目录 `.env.local`，通用约定见 `../../AGENTS.md`。

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

**名称**：mewCat（译趣喵）<br>
**类型**：Chrome MV3 浏览器扩展<br>
**框架**：WXT 0.21.4（Vite 8）<br>
**语言**：TypeScript 5.8.3<br>
**包管理**：pnpm 10.20.0

浏览器翻译插件，支持沉浸式翻译、划词翻译、图片翻译，通过第三方 LLM API 驱动翻译能力。

---

## Agent 编码规范

### `src` 目录结构

| 目录 | 职责 |
| --- | --- |
| `entrypoints/` | 存放 WXT 一级入口，负责注册、初始化和挂载。 |
| `pages/` | 组织 `options`、`popup`、`sidepanel`、`feedback` 的页面布局与页面级状态。 |
| `components/` | 存放通用 UI 组件和可复用的业务组件。 |
| `features/` | 按业务组织翻译、图片翻译、页面总结、阅读和用量统计等能力。 |
| `hooks/` | 存放跨组件复用的自定义 Hook。 |
| `contexts/` | 存放 React Context、Provider 组件和对应的读取 Hook。 |
| `state/` | 存放全局状态、状态更新和持久化逻辑。 |
| `services/` | 封装 API 请求、监控和外部服务调用。 |
| `messaging/` | 存放扩展各运行环境之间的消息协议、类型和通信封装。 |
| `background/` | 处理后台任务、浏览器事件和后台消息。 |
| `contents/` | 负责网页注入、DOM 集成和页面生命周期管理。 |
| `types/` | 存放跨模块共享的 TypeScript 类型。 |
| `constants/` | 存放跨模块共享的常量和固定配置。 |
| `utils/` | 存放跨模块复用的工具函数。 |
| `styles/` | 存放全局主题、CSS 变量和共享样式。 |
| `public/` | 存放扩展使用的静态资源。 |
| `docs/` | 存放与源码直接相关的实现说明。 |

### 组件目录与导出

`src/components/` 根目录只允许 `index.ts` 作为独立文件。组件目录内的主组件、原子组件和辅助文件同级平铺。

```text
components/
├── index.ts
└── TranslationRolePicker/
    ├── index.ts
    ├── TranslationRolePicker.tsx
    ├── PinnedRoleTag.tsx
    ├── types.ts
    ├── constants.ts
    ├── utils.ts
    └── styles.ts
```

- `index.ts` 是组件目录的公开导出入口。外部从组件目录导入，目录内的文件彼此直接引用。
- 主组件组装界面和协调交互。原子组件的职责应单一，例如 `PinnedRoleTag.tsx` 负责展示一枚常用角色标签并处理选择和移除操作。
- `types.ts` 存放 Props 和组件专用类型。`constants.ts` 存放固定配置。`utils.ts` 存放纯工具函数。`styles.ts` 存放组件样式。
- 按实际内容创建辅助文件。类型、常量和工具需要跨模块复用时，迁入对应的公共目录。
- `index.ts` 导出公开成员。整个工具模块都需要公开时，可以写 `export * from "./utils"`。

### React 组件与 Context

主组件和原子组件统一使用具名的 `export const Test: React.FC<TestProps>` 声明。无 Props 的组件可以写 `React.FC`。

```tsx
export const Test: React.FC<TestProps> = ({ label }) => {
    return <span>{label}</span>
}
```

需要 `React.memo` 时，可以声明内部组件，再具名导出包装后的组件。需要向外透传 DOM 或组件 `ref` 时，可以具名导出 `React.forwardRef` 包装的组件，保持 React 18 的 `ref` 接口。

自定义 Context 必须封装为独立的 Provider 组件。Provider 负责管理状态、组织上下文值并渲染 `children`，便于独立优化。需要统一读取方式时，可提供相应的自定义 Hook。

### Hook、组件内函数与注释

- Hook 按类型分组，不同组之间空一行。建议顺序为 `useContext`、`useState`、`useRef`、`useMemo`、`useCallback`、`useEffect`，有先后依赖时按实际依赖顺序排列。
- 在组件渲染体内声明的具名函数统一使用 `useCallback`。Hook 自身的回调以及 `map`、`filter` 的就地回调可以直接传入。
- `useMemo`、`useCallback` 和 `useEffect` 的依赖数组按实际引用填写，并遵循 `react-hooks/exhaustive-deps`。
- 每条代码注释用一句话写完，控制在一行。优先说明业务意图、兼容约束或容易误判的边界。

---

## 核心架构

### 翻译引擎（`src/features/translation/`）

```
ImmersiveTranslator.ts       # 沉浸式翻译编排器（入口）
translationService.ts        # 根据配置选择翻译服务
modelTranslation.ts          # 构建提示词并调用后台模型网关
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
5. `translationService.ts` 根据配置选择翻译服务
6. `modelTranslation.ts` 构建生成式模型请求，后台模型网关负责调用对应 API
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

**官方与自定义地址**。官方端点由 `src/features/model-management/providers.ts` 提供。自定义模式读取 `params.baseUrl`，模型网关按当前模型配置调用 API。

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

`../../.github/workflows/release-extension.yml`：push 到 `main` 时自动执行。

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

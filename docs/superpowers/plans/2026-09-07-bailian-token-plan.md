# 阿里百炼 Token Plan 接入实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为阿里百炼增加 Token Plan 中国站和国际站官方通道，同时保持现有按量付费、自定义接口及其他供应商行为不变。

**Architecture:** 在供应商注册表中增加官方端点档案，配置只保存 `officialEndpointId`，所有模型发现、连接测试、文本请求和视觉请求统一通过端点解析器获得 Base URL。Token Plan 模型发现禁止回退到按量付费公共目录，设置页提供端点选择和使用范围提示。

**Tech Stack:** TypeScript 5.8、React 18、Jotai、styled-components、Vitest、Zod、WXT MV3。

**Spec:** `docs/superpowers/specs/2026-09-07-bailian-token-plan-design.md`

## Global Constraints

- Token Plan 只新增 OpenAI-compatible 文本生成和视觉理解接入；不实现 Coding Plan、Responses API、Harness 或媒体生成。
- Token Plan 中国站地址固定为 `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/`。
- Token Plan 国际站地址固定为 `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/`。
- 旧配置缺少 `officialEndpointId` 时继续走按量付费中国站地址。
- 不根据 `sk-sp-` 前缀自动切换通道，也不打印完整 API Key。
- Token Plan 远程模型发现失败时不得显示按量付费公共目录候选。
- 修改 `src/` 后运行 `pnpm format`；每个任务完成后运行对应测试；最终必须运行 `pnpm check`。
- 维护当前工作区已有的 `AGENTS.md`、Logo、`TranslationControlCenter.tsx`、`state/util.ts` 及未跟踪文件，不覆盖或重置这些改动。

## 文件边界

- `src/types/aiModel.ts`：增加可选官方端点标识。
- `src/types/extensionConfigSchema.ts`：校验并保留端点标识。
- `src/model-management/providers.ts`：定义官方端点档案、统一解析、Token Plan 判断及目录回退策略。
- `src/model-management/discovery.ts`：携带端点标识并区分 Token Plan 的发现失败策略。
- `src/components/ModelDiscoveryField/index.tsx`：端点变化时重新发现，Token Plan 发现不支持时允许手动模型 ID。
- `src/background/messages/model-gateway.ts`：统一使用新解析器并产生通道相关错误。
- `src/messaging/modelGatewayContracts.ts`：增加不可重试的配置错误码。
- `src/image-translation/providers.ts`：将配置错误转换为安全的视觉模型不可用错误。
- `src/options/BailianOfficialEndpointFields.tsx`：新增阿里百炼官方通道选择与风险提示组件。
- `src/options/TranslateServices.tsx`：接入通道组件、展示动态 URL、保留 Key、让 Token Plan 可显式声明视觉能力。
- `test/model-management.test.ts`：端点档案、默认兼容、自定义、目录策略测试。
- `test/extension-config-validation.test.ts`：新字段保留与旧配置兼容测试。
- `test/model-discovery-field.test.tsx`：端点传递和 Token Plan 手动模型入口测试。
- `test/model-gateway.test.ts`：文本/视觉路由和错误映射测试。
- `test/bailian-token-plan-settings.test.tsx`：通道选择、风险提示和非百炼隐藏测试。
- `test/image-translation-providers.test.ts`：配置错误映射测试。
- `AGENTS.md`：最终验证通过后追加修改记录；不提交当前已有的无关改动。

---

### Task 1: 建立官方端点档案和配置兼容层

**Files:**
- Modify: `src/types/aiModel.ts`
- Modify: `src/types/extensionConfigSchema.ts`
- Modify: `src/model-management/providers.ts`
- Test: `test/model-management.test.ts`
- Test: `test/extension-config-validation.test.ts`

**Interfaces:**

新增以下接口和函数，后续任务只依赖这些公开接口：

```typescript
export type OfficialEndpointMode = "pay-as-you-go" | "token-plan"

export interface OfficialEndpointDefinition {
    id: string
    label: string
    baseUrl: string
    mode: OfficialEndpointMode
    catalogFallback: "catalog" | "manual"
}

export interface ProviderEndpointSelection {
    provider: AiModel_Platform_Enum
    isOfficial: boolean
    customBaseUrl?: string
    officialEndpointId?: string
}

export class ProviderConfigurationError extends Error {}

export function getOfficialEndpointOptions(
    provider: AiModel_Platform_Enum
): OfficialEndpointDefinition[]

export function getGenerationBaseUrl(
    selection: ProviderEndpointSelection
): string

export function isTokenPlanEndpoint(
    selection: ProviderEndpointSelection
): boolean

export function canFallbackToCatalog(
    selection: ProviderEndpointSelection
): boolean
```

- [ ] **Step 1: Write failing endpoint and schema tests**

在 `test/model-management.test.ts` 增加以下行为断言：

```typescript
it("resolves Bailian Token Plan China and international endpoints", () => {
    expect(
        getGenerationBaseUrl({
            provider: AiModel_Platform_Enum.BAILIAN,
            isOfficial: true,
            officialEndpointId: "token-plan-cn"
        })
    ).toBe("https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/")

    expect(
        getGenerationBaseUrl({
            provider: AiModel_Platform_Enum.BAILIAN,
            isOfficial: true,
            officialEndpointId: "token-plan-intl"
        })
    ).toBe("https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/")
})

it("keeps legacy official providers and custom URLs compatible", () => {
    expect(
        getGenerationBaseUrl({
            provider: AiModel_Platform_Enum.OPENAI,
            isOfficial: true
        })
    ).toBe("https://api.openai.com/v1/")
    expect(
        getGenerationBaseUrl({
            provider: AiModel_Platform_Enum.BAILIAN,
            isOfficial: false,
            customBaseUrl: " https://proxy.test/v1/// "
        })
    ).toBe("https://proxy.test/v1/")
})

it("rejects an unknown official endpoint instead of silently using pay-as-you-go", () => {
    expect(() =>
        getGenerationBaseUrl({
            provider: AiModel_Platform_Enum.BAILIAN,
            isOfficial: true,
            officialEndpointId: "wrong-channel"
        })
    ).toThrow(ProviderConfigurationError)
})

it("disables public catalog fallback for Token Plan", () => {
    expect(
        canFallbackToCatalog({
            provider: AiModel_Platform_Enum.BAILIAN,
            isOfficial: true,
            officialEndpointId: "token-plan-cn"
        })
    ).toBe(false)
})
```

在 `test/extension-config-validation.test.ts` 增加：旧模型没有新字段时保持有效，以及 `officialEndpointId: "token-plan-intl"` 能从存储修复结果中保留。

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/model-management.test.ts test/extension-config-validation.test.ts
```

Expected: 新增端点解析测试失败，现有测试保持通过。

- [ ] **Step 3: Implement registry profiles and resolver**

在 `ProviderDefinition` 增加 `officialEndpoints?: OfficialEndpointDefinition[]`，为 BAILIAN 注册：

```typescript
officialEndpoints: [
    {
        id: "pay-as-you-go-cn",
        label: "按量付费（中国站）",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
        mode: "pay-as-you-go",
        catalogFallback: "catalog"
    },
    {
        id: "token-plan-cn",
        label: "Token Plan（中国站·北京）",
        baseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/",
        mode: "token-plan",
        catalogFallback: "manual"
    },
    {
        id: "token-plan-intl",
        label: "Token Plan（国际站·新加坡）",
        baseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/",
        mode: "token-plan",
        catalogFallback: "manual"
    }
]
```

保持原 `generationBaseUrl` 作为未设置 `officialEndpointId` 时的默认地址。自定义模式继续要求非空 `customBaseUrl`，官方模式的未知 ID 抛出 `ProviderConfigurationError`。

在 `BaseModel.params` 增加 `officialEndpointId?: string`，在 `BaseModelSchema.params` 增加 `z.string().optional()`。

- [ ] **Step 4: Run focused tests and verify pass**

Run:

```bash
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/model-management.test.ts test/extension-config-validation.test.ts
```

Expected: 全部通过。

- [ ] **Step 5: Format and commit only Task 1 files**

Run `pnpm format`，再执行同一组 Vitest。仅提交 Task 1 的三个源文件和两个测试文件：

```bash
git add src/types/aiModel.ts src/types/extensionConfigSchema.ts src/model-management/providers.ts test/model-management.test.ts test/extension-config-validation.test.ts
git commit -m "feat: add Bailian official endpoint profiles"
```

---

### Task 2: 让网关统一走端点解析并区分错误

**Files:**
- Modify: `src/background/messages/model-gateway.ts`
- Modify: `src/messaging/modelGatewayContracts.ts`
- Modify: `src/image-translation/providers.ts`
- Test: `test/model-gateway.test.ts`
- Test: `test/image-translation-providers.test.ts`

**Interfaces:**

- 网关所有 `getGenerationBaseUrl` 调用改为传入 `{ provider, isOfficial, customBaseUrl, officialEndpointId }`。
- `ModelGatewayErrorCode` 增加 `"INVALID_CONFIGURATION"`。
- `mapGatewayError` 接收当前 `BaseModel`，据此生成 Token Plan 专属认证、模型和额度提示。

- [ ] **Step 1: Write failing gateway tests**

在 `test/model-gateway.test.ts` 增加：

```typescript
it("routes Bailian generation through the selected Token Plan endpoint", async () => {
    let received: Record<string, unknown> | undefined
    await handleModelGatewayRequest(
        generateRequest(
            createModel(AiModel_Platform_Enum.BAILIAN, {
                officialEndpointId: "token-plan-intl"
            })
        ),
        {
            generateText: async options => {
                received = options
                return { text: "ok" }
            }
        }
    )
    expect(received).toMatchObject({
        baseURL: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/"
    })
})
```

同时测试 Token Plan 的 401、404、429 消息含通道上下文，以及未知端点返回 `INVALID_CONFIGURATION`；视觉请求也必须使用同一国际端点。

- [ ] **Step 2: Run gateway tests and verify failure**

Run:

```bash
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/model-gateway.test.ts test/image-translation-providers.test.ts
```

Expected: 新增路由和错误断言失败。

- [ ] **Step 3: Implement gateway changes**

为请求中的模型构造统一选择对象，文本、结构化视觉、视觉降级文本和 DeepL 分支都使用该解析结果。视觉分支将 `commonOptions` 的构造放进 `try`，让未知端点也能被统一转换为失败响应。

`mapGatewayError` 规则：

```typescript
if (error instanceof ProviderConfigurationError) {
    return failure("INVALID_CONFIGURATION", error.message)
}
if (status === 401 || status === 403) {
    return failure(
        "AUTHENTICATION_FAILED",
        tokenPlan ? "Token Plan 认证失败，请检查当前区域的 sk-sp- 专属 API Key" : "模型认证失败，请检查 API Key",
        status
    )
}
if (status === 404) {
    return failure(
        "MODEL_NOT_FOUND",
        tokenPlan ? "模型不在当前 Token Plan 套餐或地区支持范围内" : "所选模型不存在或当前账号无权访问",
        status
    )
}
if (status === 429 && tokenPlan) {
    return failure("RATE_LIMITED", "请求过于频繁或 Token Plan Credits 已用尽", status)
}
```

视觉 provider 将 `INVALID_CONFIGURATION` 映射为 `MODEL_UNAVAILABLE`，不暴露内部端点细节。

- [ ] **Step 4: Run gateway tests and verify pass**

Run the focused command from Step 2. Expected: all gateway and visual provider tests pass.

- [ ] **Step 5: Format and commit only Task 2 files**

Run `pnpm format`，再提交：

```bash
git add src/background/messages/model-gateway.ts src/messaging/modelGatewayContracts.ts src/image-translation/providers.ts test/model-gateway.test.ts test/image-translation-providers.test.ts
git commit -m "feat: route Bailian requests by endpoint profile"
```

---

### Task 3: 收紧 Token Plan 模型发现

**Files:**
- Modify: `src/model-management/discovery.ts`
- Modify: `src/components/ModelDiscoveryField/index.tsx`
- Test: `test/model-management.test.ts`
- Test: `test/model-discovery-field.test.tsx`

**Interfaces:**

`ProviderConnection` 增加 `officialEndpointId?: string`。`discoverModels` 通过 `canFallbackToCatalog(connection)` 决定失败策略。

- [ ] **Step 1: Write failing discovery tests**

增加以下测试：

```typescript
it("does not return public catalog candidates when Token Plan discovery fails", async () => {
    await expect(
        discoverModels(
            {
                provider: AiModel_Platform_Enum.BAILIAN,
                apiKey: "secret",
                isOfficial: true,
                officialEndpointId: "token-plan-cn"
            },
            {
                listOpenAiModels: async () => {
                    throw new Error("404")
                },
                loadCatalog: async () => [
                    { id: "payg-only", name: "Payg only" }
                ]
            }
        )
    ).rejects.toMatchObject({ code: "DISCOVERY_UNSUPPORTED" })
})
```

补充远程模型成功时仍只返回远程结果、并将 `officialEndpointId` 传给 `listOpenAiModels` 的断言；在 jsdom 测试中验证官方 Token Plan 发现失败后显示手动模型输入。

- [ ] **Step 2: Run discovery tests and verify failure**

Run:

```bash
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/model-management.test.ts test/model-discovery-field.test.tsx
```

Expected: 新增 Token Plan 断言失败。

- [ ] **Step 3: Implement strict discovery policy**

在 `discoverModels` 中从 HTTP 错误读取状态：401/403 转为 `AUTHENTICATION_FAILED`；404/405 在 Token Plan 中转为 `DISCOVERY_UNSUPPORTED`；其他 Token Plan 网络错误转为 `NETWORK_FAILURE`，且不返回目录候选。按量付费官方模式继续保留当前公共目录回退。

`ModelDiscoveryField` 的 effect 依赖加入 `model.params.officialEndpointId`，请求连接对象携带该字段；`DISCOVERY_UNSUPPORTED` 不再要求 `!isOfficial` 才进入手动输入状态。

- [ ] **Step 4: Run discovery tests and verify pass**

重复 Step 2 命令，预期全部通过。

- [ ] **Step 5: Format and commit only Task 3 files**

```bash
pnpm format
git add src/model-management/discovery.ts src/components/ModelDiscoveryField/index.tsx test/model-management.test.ts test/model-discovery-field.test.tsx
git commit -m "feat: restrict Bailian Token Plan model discovery"
```

---

### Task 4: 增加设置页通道选择和风险提示

**Files:**
- Create: `src/options/BailianOfficialEndpointFields.tsx`
- Modify: `src/options/TranslateServices.tsx`
- Test: `test/bailian-token-plan-settings.test.tsx`

**Interfaces:**

新增组件：

```typescript
interface BailianOfficialEndpointFieldsProps {
    model: BaseModel
    onEndpointChange: (officialEndpointId: string) => void
}

export function BailianOfficialEndpointFields(
    props: BailianOfficialEndpointFieldsProps
): React.ReactElement | null
```

- [ ] **Step 1: Write failing component tests**

测试渲染百炼官方模型时存在 `pay-as-you-go-cn`、`token-plan-cn`、`token-plan-intl` 三个选项；切换到国际 Token Plan 时回调 `token-plan-intl`；Token Plan 显示官方使用范围链接；OpenAI 模型和百炼自定义模型不渲染该组件。

- [ ] **Step 2: Run settings test and verify failure**

Run:

```bash
pnpm exec vitest run --config test/vitest.image-translation.config.ts --environment jsdom test/bailian-token-plan-settings.test.tsx
```

Expected: 新组件缺失导致失败。

- [ ] **Step 3: Implement focused endpoint component**

组件使用 `NativeSelect` 和 `FormRow`，从 `getOfficialEndpointOptions(AiModel_Platform_Enum.BAILIAN)` 生成选项；Token Plan 时显示 `role="note"` 的提示和 `https://help.aliyun.com/zh/model-studio/more-tools` 链接。

- [ ] **Step 4: Integrate with TranslateServices**

在“官方模型 / 自定义”切换后插入该组件。官方请求地址改为使用当前 `officialEndpointId` 解析；切换通道只更新 `officialEndpointId`，不修改 `apiKey` 和 `modelName`。当前模型为 Token Plan 时：

- API Key helper text 改为当前地区 Token Plan 专属 Key 提示。
- 视觉能力开关条件从 `!isOfficial` 扩展为 `!isOfficial || isTokenPlanEndpoint(...)`。
- 模型发现回调继续保存远程视觉能力，用户手动填写时保留显式开关。

其他平台仍显示原来的官方/自定义和只读官方 URL。

- [ ] **Step 5: Run settings tests and verify pass**

Run the focused command from Step 2, then run:

```bash
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/test-translation-services-empty-state.tsx
```

Expected: Token Plan UI 测试和既有设置空状态测试通过。

- [ ] **Step 6: Format and commit only Task 4 files**

```bash
pnpm format
git add src/options/BailianOfficialEndpointFields.tsx src/options/TranslateServices.tsx test/bailian-token-plan-settings.test.tsx
git commit -m "feat: add Bailian Token Plan settings"
```

---

### Task 5: 全量验证、文档记录和交付检查

**Files:**
- Modify: `AGENTS.md`（只追加本功能记录，保留已有用户改动）

- [ ] **Step 1: Run focused regression suite**

```bash
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/model-management.test.ts test/extension-config-validation.test.ts test/model-discovery-field.test.tsx test/model-gateway.test.ts test/image-translation-providers.test.ts test/bailian-token-plan-settings.test.tsx
```

预期所有新增与受影响测试通过。

- [ ] **Step 2: Run formatting and full quality gate**

```bash
pnpm format
pnpm check
```

预期 `pnpm check` 退出码为 0；允许记录既有 lint warning，不接受新增 error。

- [ ] **Step 3: Append the modification record after the successful check**

在 `AGENTS.md` 末尾追加：

```markdown
### 2026-09-07 — 支持阿里百炼 Token Plan

**修改内容**：

- `src/model-management/providers.ts`、`src/types/aiModel.ts`、`src/types/extensionConfigSchema.ts`：增加官方端点档案和存储字段，兼容按量付费、Token Plan 中国站/国际站及自定义地址
- `src/model-management/discovery.ts`、`src/background/messages/model-gateway.ts`：统一按通道路由模型发现、文本和视觉请求，Token Plan 发现失败不回退按量付费公共目录
- `src/options/BailianOfficialEndpointFields.tsx`、`src/options/TranslateServices.tsx`：增加官方通道选择、区域 URL 展示、Key 提示、视觉能力声明和使用范围提示
- 相关测试：覆盖端点解析、配置兼容、模型发现、网关错误和设置页交互

**原因**：阿里百炼 Token Plan 使用独立 API Key 和 Base URL，需要同时支持中国站与国际站，并避免与按量付费通道错配。
```

- [ ] **Step 4: Inspect the final diff and status**

```bash
git diff --check
git status --short
git diff --stat -- src/types src/model-management src/background/messages/model-gateway.ts src/messaging src/image-translation src/options test
```

确认没有暂存或修改当前工作区中与本功能无关的 Logo、`TranslationControlCenter.tsx`、`state/util.ts`、`.superpowers/` 或既有计划/规格文件。

- [ ] **Step 5: Report live-key limitation**

如果本地没有用户提供的 Token Plan Key，不发送真实付费请求；交付说明中明确单元测试已通过，但中国站/国际站真实 `/models` 和翻译冒烟测试需用户自行提供对应 Key 后执行。


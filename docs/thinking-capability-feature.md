# AI 思考能力功能文档

## 📋 功能概述

为支持思考能力的 AI 模型添加了配置开关，允许用户启用或禁用深度推理功能。

**✨ 新增特性：**
- 自动检测模型是否支持思考能力
- 切换到不支持思考的模型时自动禁用思考能力
- 仅在当前模型支持思考时显示配置项

## 🎯 支持思考能力的模型

根据 `src/constants/model.ts` 分析，以下模型支持思考能力：

### 1. DeepSeek 系列
- **DeepSeek R1** (`LLM_MODEL_DEEPSEEK_R1`)
- **DeepSeek Reasoner** (`DEEPSEEK_REASONER`)

### 2. Qwen 系列
- **Qwen Plus Thinking** (`LLM_MODEL_QWEN_PLUS_LATEST_THINKING`)
- **Qwen Turbo Thinking** (`LLM_MODEL_QWEN_TURBO_LATEST_THINKING`)
- **QwQ Plus** (`LLM_MODEL_QWQ_PLUS_LATEST`)

### 3. 豆包系列
- **豆包-1.5 Thinking Pro** (`LLM_MODEL_DOUBAO_1d5_THINKING_PRO_250415`)
- **doubao-seed-1.6-thinking** (`doubao_seed_1_6_thinking`)

### 4. 混元系列
- **Hunyuan T1 Latest** (`HUNYUAN_T1_LATEST`)
- **Hunyuan T1 20250822** (`HUNYUAN_T1_20250822`)

## 🔧 实现细节

### 1. 思考能力模型集合

在 `src/constants/model.ts` 中定义：

```typescript
/**
 * 支持思考能力的模型集合
 * 包含所有具有深度推理能力的模型
 */
export const THINKING_CAPABLE_MODELS = new Set<LLMModel>([
    // DeepSeek 系列
    DEEPSEEK_LLM.DEEPSEEK_REASONER,
    SystemLLMModel.LLM_MODEL_DEEPSEEK_R1,

    // Qwen 系列
    SystemLLMModel.LLM_MODEL_QWEN_PLUS_LATEST_THINKING,
    SystemLLMModel.LLM_MODEL_QWEN_TURBO_LATEST_THINKING,
    SystemLLMModel.LLM_MODEL_QWQ_PLUS_LATEST,

    // 豆包系列
    SystemLLMModel.LLM_MODEL_DOUBAO_1d5_THINKING_PRO_250415,
    Huoshan_LLM.doubao_seed_1_6_thinking,

    // 混元系列
    HUNYUAN_LLM.HUNYUAN_T1_LATEST,
    HUNYUAN_LLM.HUNYUAN_T1_20250822
])
```

### 2. 工具函数

在 `src/utils/llmModel.ts` 中添加检测函数：

```typescript
/**
 * 检查模型是否支持思考能力
 * @param model - 模型版本号
 * @returns 是否支持思考能力
 */
export function isThinkingCapableModel(model: LLMModel | undefined | null): boolean {
    if (!model) {
        return false
    }
    return THINKING_CAPABLE_MODELS.has(model)
}

/**
 * 检查 BaseModel 是否支持思考能力
 * @param model - BaseModel 对象
 * @returns 是否支持思考能力
 */
export function isModelThinkingCapable(model: BaseModel | undefined | null): boolean {
    if (!model?.params?.modelVersion) {
        return false
    }
    return isThinkingCapableModel(model.params.modelVersion)
}
```

### 3. UI 智能显示

在 `src/options/TranslateServices.tsx` 中实现：

#### 3.1 检测当前模型是否支持思考

```typescript
// 检查当前模型是否支持思考能力
const currentModelSupportsThinking = useMemo(() => {
    const currentModel = config?.aiModelList?.find(
        model => model.id === config.currentModel
    )
    return isModelThinkingCapable(currentModel)
}, [config?.aiModelList, config?.currentModel])
```

#### 3.2 条件渲染配置项

```tsx
{currentModelSupportsThinking && (
    <FormRow
        label="启用思考能力"
        description="为支持思考的模型（如 DeepSeek R1、QwQ、Thinking 系列）启用深度推理能力，可能会增加响应时间"
    >
        <Switch
            checked={config.enableThinking || false}
            onChange={checked =>
                updateConfig({ enableThinking: checked })
            }
        />
    </FormRow>
)}
```

### 4. 自动配置更新

#### 4.1 模型切换时自动更新

```typescript
// 处理当前模型切换
const handleCurrentModelChange = useCallback(
    (value: string) => {
        const selectedModel = config?.aiModelList?.find(
            model => model.id === value
        )

        // 如果切换到不支持思考的模型，自动禁用思考能力
        if (selectedModel && !isModelThinkingCapable(selectedModel)) {
            updateConfig({
                currentModel: value,
                enableThinking: false
            })
        } else {
            updateConfig({ currentModel: value })
        }
    },
    [config?.aiModelList, updateConfig]
)
```

#### 4.2 模型删除时自动更新

```typescript
// 监听模型删除，如果当前选中的模型被删除，自动切换到第一个可用模型
useEffect(() => {
    const currentModel = config?.currentModel
    const modelExists = config?.aiModelList?.some(
        model => model.id === currentModel && model.enabled
    )

    if (!modelExists && config?.aiModelList?.length > 0) {
        // 找到第一个启用的模型
        const firstEnabledModel = config.aiModelList.find(
            model => model.enabled
        )
        if (firstEnabledModel) {
            // 如果新模型不支持思考，自动禁用思考能力
            if (!isModelThinkingCapable(firstEnabledModel)) {
                updateConfig({
                    currentModel: firstEnabledModel.id,
                    enableThinking: false
                })
            } else {
                updateConfig({ currentModel: firstEnabledModel.id })
            }
        }
    }
}, [config?.aiModelList, config?.currentModel, updateConfig])
```

### 5. 类型定义

#### ExtensionConfig (`src/types/config.ts`)
```typescript
export interface ExtensionConfig {
    // ... 其他配置
    /** 是否启用 AI 思考能力（适用于支持思考的模型，默认 false） */
    enableThinking?: boolean
}
```

#### AiStreamRequestConfig (`src/types/request.ts`)
```typescript
export interface AiStreamRequestConfig {
    // ... 其他配置
    enableThinking?: boolean
}
```

#### AiHttpRequestConfig (`src/types/request.ts`)
```typescript
export interface AiHttpRequestConfig {
    // ... 其他配置
    enableThinking?: boolean
}
```

### 6. 默认配置

在 `src/state/constants.ts` 中添加默认值：

```typescript
export const defaultExtensionConfig: ExtensionConfig = {
    // ... 其他配置
    enableThinking: false  // 默认关闭
}
```

### 7. 数据流

```
用户配置 (ExtensionConfig)
    ↓
ImmersiveTranslator
    ↓
translationService / modelTranslation
    ↓
后台统一模型网关（xsAI）
    ↓
供应商 API 请求
```

## 📝 使用说明

### 用户操作步骤

1. 打开扩展设置页面
2. 导航到 "翻译服务" 标签
3. 选择支持思考能力的模型（如 DeepSeek R1）
4. 在 "配置" 部分会自动显示 "启用思考能力" 开关
5. 切换开关以启用或禁用思考能力
6. 配置会自动保存并同步

### 智能行为

#### 1. 自动显示/隐藏
- **支持思考的模型**：显示 "启用思考能力" 开关
- **不支持思考的模型**：自动隐藏该配置项

#### 2. 自动禁用
当切换到不支持思考的模型时，系统会自动：
- 将 `enableThinking` 设置为 `false`
- 隐藏思考能力配置项
- 保持其他配置不变

#### 3. 配置保持
当切换到支持思考的模型时：
- 保持之前的 `enableThinking` 配置
- 显示思考能力配置项
- 用户可以自由开启或关闭

### 注意事项

- **默认状态：** 思考能力默认关闭
- **适用模型：** 仅对支持思考的模型有效（见上文列表）
- **性能影响：** 启用思考能力可能会增加响应时间，因为模型需要进行更深入的推理
- **翻译质量：** 对于复杂内容，启用思考能力可能会提供更准确的翻译
- **自动管理：** 系统会自动管理配置，无需手动调整

## 🔍 测试建议

### 功能测试

1. **配置保存测试**
   - 启用思考能力，刷新页面，确认配置保持
   - 禁用思考能力，刷新页面，确认配置保持

2. **模型切换测试**
   - 从支持思考的模型切换到不支持的模型，确认思考能力自动禁用
   - 从不支持思考的模型切换到支持的模型，确认配置项显示
   - 验证配置项的显示/隐藏逻辑

3. **翻译测试**
   - 使用支持思考的模型（如 DeepSeek R1）
   - 启用思考能力，翻译复杂文本
   - 禁用思考能力，翻译相同文本
   - 对比翻译质量和响应时间

4. **兼容性测试**
   - 使用不支持思考的模型，确认配置项不显示
   - 切换不同模型，确认配置正确传递

### 性能测试

1. **响应时间对比**
   - 记录启用思考能力前后的翻译响应时间
   - 评估性能影响是否在可接受范围内

2. **并发测试**
   - 同时翻译多个段落，观察思考能力对并发性能的影响

## 🐛 已知问题

目前没有已知问题。

## 📅 更新日志

### 2026-02-02 (v2)
- ✨ 添加 `THINKING_CAPABLE_MODELS` 集合
- 🎨 添加 `isThinkingCapableModel` 和 `isModelThinkingCapable` 工具函数
- 🔧 实现配置项智能显示/隐藏
- 🤖 实现模型切换时自动更新 `enableThinking` 配置
- 📝 完善文档，添加智能行为说明

### 2026-02-02 (v1)
- ✨ 添加 `enableThinking` 配置字段到所有相关接口
- 🎨 在设置页面添加思考能力开关
- 🔧 配置默认值为 `false`
- 📝 完善类型定义和数据流
- ✅ 通过所有代码检查（typecheck, lint, format, spell）

## 🔗 相关文件

- `src/constants/model.ts` - 思考能力平台集合
- `src/model-management/providers.ts` - 供应商注册与官方请求地址
- `src/utils/llmModel.ts` - 模型工具函数
- `src/types/config.ts` - 配置类型定义
- `src/types/request.ts` - 请求类型定义
- `src/state/constants.ts` - 默认配置
- `src/options/TranslateServices.tsx` - UI 配置界面
- `src/translation/ImmersiveTranslator.ts` - 翻译管理器
- `src/translation/translationService.ts` - 函数式翻译路由
- `src/background/messages/model-gateway.ts` - xsAI 统一模型网关

## 💡 未来改进

1. **智能推荐**
   - ✅ 根据当前选择的模型，自动显示是否支持思考能力
   - 对于支持思考的模型，提供推荐提示

2. **性能优化**
   - 添加思考能力的超时配置
   - 提供"快速模式"和"深度思考模式"切换

3. **用户反馈**
   - 收集用户对思考能力效果的反馈
   - 根据反馈优化默认配置

4. **文档完善**
   - 为每个支持思考的模型添加详细说明
   - 提供最佳实践指南

## 🎓 技术亮点

1. **智能 UI**：根据模型能力动态显示配置项
2. **自动管理**：切换模型时自动更新配置，避免无效配置
3. **类型安全**：完整的 TypeScript 类型定义
4. **性能优化**：使用 `useMemo` 缓存计算结果
5. **用户友好**：无需手动管理配置，系统自动处理

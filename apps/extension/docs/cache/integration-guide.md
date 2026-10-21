# ImmersiveTranslator 缓存集成指南

## 集成步骤

### 1. 修改 ImmersiveTranslator.ts

需要替换原有的简单 Map 缓存为新的分层缓存系统。

#### 修改点 1: 导入新的缓存模块

```typescript
// 在文件顶部添加
import {
    TieredTranslationCache,
    createDefaultCache,
    type CacheKeyParams
} from "./cache"
```

#### 修改点 2: 替换缓存属性

```typescript
// 原代码（第83行）
public translationResultCache = new Map<string, string>([])

// 替换为
private translationCache: TieredTranslationCache
private currentModel: string | number
```

#### 修改点 3: 在构造函数中初始化缓存

```typescript
constructor(config: ImmersiveTranslatorConfig) {
    // ... 现有代码 ...

    // 保存当前模型ID
    this.currentModel = config.currentModel || 'default'

    // 初始化分层缓存
    this.translationCache = createDefaultCache()

    // 异步初始化缓存（不阻塞构造函数）
    this.initializeCache()

    // ... 其余代码 ...
}

/**
 * 异步初始化缓存系统
 */
private async initializeCache(): Promise<void> {
    try {
        await this.translationCache.init()
        console.log('[ImmersiveTranslator] Translation cache initialized')
    } catch (error) {
        console.error('[ImmersiveTranslator] Failed to initialize cache:', error)
    }
}
```

#### 修改点 4: 更新 updateConfig 方法

```typescript
public updateConfig(config: ImmersiveTranslatorConfig) {
    // ... 现有代码 ...

    // 更新当前模型
    this.currentModel = config.currentModel || 'default'

    // ... 其余代码 ...
}
```

#### 修改点 5: 修改 executeTranslation 方法中的缓存检查

```typescript
private async executeTranslation(
    nodes: TranslationNode[],
    options: {
        checkCache?: boolean
        useConcurrentGroups?: boolean
        onBatchComplete?: (batch: Message[]) => void
    } = {}
): Promise<boolean> {
    const { checkCache = true, useConcurrentGroups = false } = options

    if (this.isTranslationAborted) {
        return false
    }

    // 构建翻译消息（使用新缓存系统）
    const translationMessages: Message[] = []

    for (const node of nodes) {
        const nodeId = node.id

        // 检查缓存
        if (checkCache) {
            const cacheParams: CacheKeyParams = {
                text: node.originText,
                sourceLang: this.detectedLanguage,
                targetLang: this.targetLanguage,
                modelId: this.currentModel,
                aiRole: this.translationServiceManager.getAiRole()?.name || 'default'
            }

            const cachedResult = await this.translationCache.get(cacheParams)

            if (cachedResult) {
                this.renderTranslationResults([
                    { id: nodeId, text: cachedResult }
                ])
                continue
            }
        }

        translationMessages.push({
            role: "user",
            content: node.originText,
            id: nodeId
        })
    }

    // ... 其余翻译逻辑保持不变 ...
}
```

#### 修改点 6: 修改 cacheTranslationResults 方法

```typescript
/**
 * 缓存翻译结果
 * @param translationResults 翻译服务返回的结果对象
 */
private async cacheTranslationResults(
    translationResults: { id: string; text: string }[]
): Promise<void> {
    for (const { id, text } of translationResults) {
        const sourceNode = find(v => v.id === id, this.sourceTextNodes)
        if (sourceNode) {
            // 使用新缓存系统
            const cacheParams: CacheKeyParams = {
                text: sourceNode.originText,
                sourceLang: this.detectedLanguage,
                targetLang: this.targetLanguage,
                modelId: this.currentModel,
                aiRole: this.translationServiceManager.getAiRole()?.name || 'default'
            }

            // 设置缓存（7天过期）
            await this.translationCache.set(
                cacheParams,
                text,
                7 * 24 * 60 * 60 * 1000
            )

            sourceNode.translateText = text
        }
    }
}
```

#### 修改点 7: 在 clearAllTranslations 中清理缓存

```typescript
public clearAllTranslations() {
    // ... 现有清理代码 ...

    // 注意：不要清空持久化缓存，只清理内存状态
    // this.translationCache.clear() // 不调用这个

    // ... 其余代码 ...
}
```

#### 修改点 8: 添加缓存统计方法（可选）

```typescript
/**
 * 获取缓存统计信息
 */
public async getCacheStats() {
    return await this.translationCache.getStats()
}

/**
 * 手动清理缓存
 */
public async cleanupCache(options?: {
    maxAge?: number
    maxSize?: number
    minHitCount?: number
}) {
    return await this.translationCache.cleanup(options)
}
```

### 2. 修改 TranslationServiceManager.ts

需要添加获取 AI 角色的方法。

```typescript
/**
 * 获取当前 AI 角色
 */
public getAiRole() {
    return this.aiRole
}
```

### 3. 更新类型定义

确保 `detectedLanguage` 可以被访问（如果需要）。

## 完整的修改示例

```typescript
// ImmersiveTranslator.ts 的关键修改

import {
    TieredTranslationCache,
    createDefaultCache,
    type CacheKeyParams
} from "./cache"

export class ImmersiveTranslator {
    // 替换原有的 Map 缓存
    private translationCache: TieredTranslationCache
    private currentModel: string | number

    constructor(config: ImmersiveTranslatorConfig) {
        // 保存当前模型
        this.currentModel = config.currentModel || 'default'

        // 初始化分层缓存
        this.translationCache = createDefaultCache()
        this.initializeCache()

        // ... 其余初始化代码 ...
    }

    private async initializeCache(): Promise<void> {
        try {
            await this.translationCache.init()
            console.log('[ImmersiveTranslator] Cache initialized')
        } catch (error) {
            console.error('[ImmersiveTranslator] Cache init failed:', error)
        }
    }

    private async executeTranslation(
        nodes: TranslationNode[],
        options = {}
    ): Promise<boolean> {
        // 使用新缓存检查
        const translationMessages: Message[] = []

        for (const node of nodes) {
            if (options.checkCache) {
                const cached = await this.translationCache.get({
                    text: node.originText,
                    sourceLang: this.detectedLanguage,
                    targetLang: this.targetLanguage,
                    modelId: this.currentModel,
                    aiRole: this.translationServiceManager.getAiRole()?.name || 'default'
                })

                if (cached) {
                    this.renderTranslationResults([{ id: node.id, text: cached }])
                    continue
                }
            }

            translationMessages.push({
                role: "user",
                content: node.originText,
                id: node.id
            })
        }

        // ... 执行翻译并缓存结果 ...
    }

    private async cacheTranslationResults(
        results: { id: string; text: string }[]
    ): Promise<void> {
        for (const { id, text } of results) {
            const node = find(v => v.id === id, this.sourceTextNodes)
            if (node) {
                await this.translationCache.set(
                    {
                        text: node.originText,
                        sourceLang: this.detectedLanguage,
                        targetLang: this.targetLanguage,
                        modelId: this.currentModel,
                        aiRole: this.translationServiceManager.getAiRole()?.name || 'default'
                    },
                    text,
                    7 * 24 * 60 * 60 * 1000 // 7天
                )
                node.translateText = text
            }
        }
    }
}
```

## 测试清单

集成完成后，需要测试以下场景：

- [ ] 首次翻译正常工作
- [ ] 相同文本第二次翻译命中缓存
- [ ] 页面刷新后缓存仍然有效（L2持久化）
- [ ] 切换语言后缓存正确失效
- [ ] 切换模型后缓存正确失效
- [ ] 动态文本（如"您有3条消息"）正确缓存
- [ ] 文本规范化正常工作（空格、换行等差异）
- [ ] 缓存统计信息正确
- [ ] 自动清理机制正常工作
- [ ] 内存占用在合理范围内

## 性能对比

### 优化前
- 首次翻译: ~500-1000ms（API调用）
- 重复翻译: ~500-1000ms（无缓存）
- 页面刷新: 所有内容重新翻译

### 优化后
- 首次翻译: ~500-1000ms（API调用）
- L1命中: ~1ms（内存缓存）
- L2命中: ~5-10ms（IndexedDB）
- 页面刷新: 大部分内容从L2加载

### 预期提升
- 缓存命中率: 60-80%
- 平均翻译速度: 提升 10-50 倍
- API调用次数: 减少 60-80%
- 用户体验: 显著提升

## 注意事项

1. **异步初始化**: 缓存初始化是异步的，不要在构造函数中等待
2. **错误处理**: 缓存失败不应影响翻译功能，应降级到直接调用API
3. **内存管理**: L1缓存有容量限制，会自动使用LRU淘汰
4. **持久化**: L2使用IndexedDB，某些浏览器可能不支持
5. **清理策略**: 默认每小时清理一次，可根据需要调整
6. **源语言检测**: 确保 `detectedLanguage` 正确设置
7. **模型ID**: 确保 `currentModel` 在配置更新时同步更新

## 故障排查

### 问题1: 缓存未命中
**检查**:
- `detectedLanguage` 是否正确
- `currentModel` 是否正确
- 文本是否被正确规范化

### 问题2: IndexedDB 错误
**解决**:
- 检查浏览器是否支持 IndexedDB
- 检查是否在隐私模式下运行
- 系统会自动降级到仅使用L1

### 问题3: 内存占用过高
**解决**:
- 减小 L1 缓存容量
- 调整清理策略
- 检查是否有内存泄漏

## 后续优化

1. **智能预热**: 在页面加载时预热常用短语
2. **相似度匹配**: 对相似文本使用近似匹配
3. **压缩存储**: 对长文本进行压缩存储
4. **分布式缓存**: 支持跨设备同步缓存
5. **缓存分析**: 添加缓存命中率分析和优化建议

# ImmersiveTranslator.ts 文档

## 概述

`ImmersiveTranslator` 是网页沉浸式翻译管理器，负责智能识别页面内容、批量翻译并在原位置显示翻译结果。它支持增量翻译、状态管理、完整的清理机制，以及强大的调试功能。

## 类结构

### ImmersiveTranslator

```typescript
export class ImmersiveTranslator
```

核心翻译管理器，提供完整的网页翻译解决方案。

## 构造函数

```typescript
constructor(config?: ExtensionConfig & { debug?: boolean })
```

**参数**
- `config` (ExtensionConfig & { debug?: boolean }, 可选): 扩展配置对象，包含翻译设置和调试模式开关

## 核心属性

### 翻译规则和内容
- `customTranslationRules`: 自定义翻译规则缓存
- `LOCAL_RULE`: 通用内置翻译规则
- `sourceTextNodes`: 原始待翻译节点列表
- `translationDisplayNodes`: 翻译结果展示节点列表
- `translationResultCache`: 翻译结果缓存映射

### 状态管理
- `isTranslating`: 是否正在进行翻译的标志
- `activeTranslationPromises`: 当前正在执行的翻译任务Promise列表
- `loadingNodeList`: Loading节点列表，用于管理加载状态

### 配置参数
- `MAX_REQUEST_BYTES`: 单次翻译请求的最大字节数限制(默认1024)
- `MAX_CONCURRENT_REQUESTS`: 同一时间最大并行翻译请求数(默认3)
- `targetLanguage`: 翻译成该语言(默认"zh-CN")
- `detectedLanguage`: 识别到网页的语言(默认"en")
- `translationStyle`: 翻译样式配置(默认"highlight")

### 可视区域优化
- `prioritizeVisibleArea`: 是否优先翻译可视区域(默认true)
- `minVisibleNodesThreshold`: 最小可视节点阈值(默认20)
- `visibleNodes`: 可视区域节点列表
- `nonVisibleNodes`: 非可视区域节点列表

### 调试功能
- `debugMode`: 调试模式标志
- `debugNodes`: 调试信息收集
- `debugRules`: 规则调试信息
- `debugPanel`: 调试面板DOM元素

## 核心方法

### 翻译控制

#### startImmersiveTranslation()
开始沉浸式翻译流程。

```typescript
public async startImmersiveTranslation(): Promise<boolean>
```

**返回值**
- `Promise<boolean>`: 翻译是否成功执行

**功能流程**
1. 检查永不翻译列表
2. 清空之前的翻译状态
3. 提取并筛选翻译节点
4. 创建翻译展示容器
5. 分批处理翻译请求
6. 渲染翻译结果

#### stopAllTranslations()
停止所有正在进行的翻译。

```typescript
public stopAllTranslations()
```

**功能**
- 取消所有HTTP请求
- 清理loading状态
- 移除未完成的翻译节点
- 重置翻译状态

#### clearAllTranslations()
完全清理所有翻译状态和DOM修改。

```typescript
public clearAllTranslations()
```

### 配置管理

#### updateConfig()
更新翻译配置。

```typescript
public updateConfig(config: ExtensionConfig)
```

#### setTargetLanguage()
设置目标翻译语言。

```typescript
public setTargetLanguage(language: string)
```

#### getTargetLanguage()
获取当前目标翻译语言。

```typescript
public getTargetLanguage(): string
```

### 内容提取

#### extractTargetTextNodes()
提取需要翻译的文本节点。

```typescript
private extractTargetTextNodes(): HTMLElement[]
```

**功能**
- 应用自定义和内置翻译规则
- 过滤重复和嵌套节点
- 验证翻译目标的有效性
- 根据可视性分类节点

#### classifyNodesByVisibility()
根据可视性分类节点。

```typescript
private classifyNodesByVisibility()
```

**功能**
- 使用getBoundingClientRect判断节点可视性
- 分离可视和非可视区域节点
- 按DOM树顺序排序节点
- 应用最小可视节点阈值策略

### 批量处理优化

#### optimizeBatchRequests()
智能分批翻译请求，优化网络性能。

```typescript
private optimizeBatchRequests(messages: Message[]): { batchedMessages: Message[][] }
```

**功能**
- 根据内容字节数合理分组
- 避免单次请求过大
- 提高翻译效率

#### controlConcurrentRequests()
控制并发翻译请求数量。

```typescript
private controlConcurrentRequests(batches: Message[][]): Message[][][]
```

**功能**
- 按并发限制分组批次
- 避免服务器压力过大
- 确保稳定的翻译性能

### 渲染和显示

#### createTranslationDisplayContainers()
创建翻译展示容器。

```typescript
private createTranslationDisplayContainers(): HTMLElement[]
```

#### renderTranslationResults()
将缓存的翻译结果渲染到页面中。

```typescript
private renderTranslationResults()
```

**功能**
- 更新翻译展示节点内容
- 根据原节点类型选择插入策略
- 清理对应的加载动画
- 更新调试信息

### 加载状态管理

#### showLoadingForAllNodes()
为所有待翻译节点显示加载动画。

```typescript
private showLoadingForAllNodes()
```

#### clearAllLoadingNodes()
清理所有loading节点。

```typescript
private clearAllLoadingNodes()
```

#### clearLoadingForBatch()
清理指定批次的加载动画。

```typescript
private clearLoadingForBatch(messageBatch: Message[])
```

## 调试功能

### 调试模式控制

#### enableDebugMode()
启用调试模式。

```typescript
public enableDebugMode(): void
```

**功能**
- 注册全局调试对象
- 初始化调试数据收集
- 启用详细日志输出

#### disableDebugMode()
禁用调试模式。

```typescript
public disableDebugMode(): void
```

### 调试信息显示

#### showDebugPanel()
显示调试面板。

```typescript
public showDebugPanel(): void
```

#### showNodesDebugInfo()
在控制台显示节点调试信息。

```typescript
public showNodesDebugInfo(): void
```

#### showRulesDebugInfo()
在控制台显示规则调试信息。

```typescript
public showRulesDebugInfo(): void
```

#### exportDebugData()
导出调试数据。

```typescript
public exportDebugData(): void
```

### 可视化调试

#### markTranslationSequence()
标记所有节点的翻译顺序。

```typescript
private markTranslationSequence(): void
```

**功能**
- 在每个待翻译节点上添加序号标签
- 区分可视和非可视区域节点
- 提供详细的控制台输出
- 高亮显示节点

## 统计和监控

### getLoadingNodeStats()
获取loading节点状态统计。

```typescript
public getLoadingNodeStats(): {
    totalLoadingNodes: number;
    activeLoadingNodes: number;
    orphanedLoadingNodes: number;
}
```

### getDomainRuleStats()
获取当前域名的规则匹配统计信息。

```typescript
public getDomainRuleStats(): {
    currentDomain: string;
    currentUrl: string;
    totalCustomRules: number;
    matchedCustomRules: number;
    // ... 更多统计信息
}
```

### getVisibilityStats()
获取可视区域统计信息。

```typescript
public getVisibilityStats(): {
    totalNodes: number;
    visibleNodes: number;
    nonVisibleNodes: number;
    threshold: number;
    prioritizeVisible: boolean;
    willTranslateAll: boolean;
}
```

## 高级功能

### 永不翻译列表
- `neverTranslateLanguages`: 永不翻译的语言列表
- `neverTranslateUrls`: 永不翻译的网址列表

### 可视区域优化
- 优先翻译用户当前可见的内容
- 后台处理非可视区域内容
- 智能阈值控制

### 翻译样式支持
- 支持多种翻译结果显示样式
- 可配置的视觉效果
- 保持良好的阅读体验

## 错误处理

1. **网络请求错误**: 自动重试和降级处理
2. **DOM操作错误**: 安全的DOM操作包装
3. **内存泄漏防护**: 完善的清理机制
4. **状态同步**: 可靠的状态管理

## 性能优化

1. **批量处理**: 智能分批减少网络请求
2. **并发控制**: 避免过载服务器
3. **缓存机制**: 避免重复翻译
4. **懒加载**: 优先处理可视区域
5. **内存管理**: 及时清理不需要的DOM节点

## 使用示例

```typescript
// 基本使用
const translator = new ImmersiveTranslator({
    targetLanguage: 'zh-CN',
    maxRequestsPerSecond: 3,
    prioritizeVisibleArea: true
});

// 开始翻译
await translator.startImmersiveTranslation();

// 启用调试模式
translator.enableDebugMode();

// 获取统计信息
const stats = translator.getVisibilityStats();

// 停止翻译
translator.stopAllTranslations();

// 清理
translator.clearAllTranslations();
```

## 依赖关系

- `translationService`: 函数式翻译路由与统一模型网关客户端
- `TranslationRule`: 翻译规则定义
- `ExtensionConfig`: 配置类型定义  
- `debugUtils`: 调试工具函数
- `utils`: 通用工具函数

## 注意事项

1. **内存管理**: 大量DOM操作需要及时清理
2. **性能影响**: 调试模式会影响性能，生产环境应关闭
3. **网络依赖**: 翻译功能完全依赖网络连接
4. **异步操作**: 所有翻译操作都是异步的
5. **浏览器兼容性**: 需要现代浏览器支持

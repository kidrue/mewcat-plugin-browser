# MutationObserverManager 文档

## 概述

`MutationObserverManager` 是一个 DOM 动态监听管理器，用于检测页面内容变化并自动触发重新翻译。

**核心特性：**
- 双层监听：自动监听翻译节点容器 + 可配置全局容器
- 智能过滤：只监听成功翻译的节点，自动跳过失败节点
- 防抖机制：避免频繁触发翻译
- 暂停/恢复：防止翻译操作引发死循环
- 增量翻译：仅重新翻译受影响的容器

## 快速开始

### 基本使用

MutationObserverManager 已集成到 ImmersiveTranslator，无需手动管理：

```typescript
// 启动翻译（会自动启动监听）
await translator.startImmersiveTranslation()

// 关闭翻译（会自动清理监听器）
translator.clearAllTranslations()
```

### 配置说明

在 `rule.json` 中配置监听规则：

```json
{
  "mutationObserverContainerSelectors": [".feed", "#timeline"],
  "mutationChangeDelay": 10
}
```

**配置项：**
- `mutationObserverContainerSelectors`: 额外监听的全局容器选择器（可选）
- `mutationChangeDelay`: 防抖延迟，单位毫秒（默认 10）

## 工作原理

### 监听策略

```
双层监听机制：
├── Layer 1: 自动监听每个翻译节点的容器
│   └── 过滤：只监听翻译成功的节点
└── Layer 2: 监听配置的全局容器（可选）
    └── 例如：.timeline, .feed 等
```

### 处理流程

```
DOM 变化
  ↓
防抖处理（默认 10ms）
  ↓
收集变化的容器
  ↓
找出受影响的翻译节点
  ↓
暂停监听
  ↓
重新提取文本 → 翻译 → 渲染
  ↓
恢复监听
```

### 关键机制

**1. 智能过滤**
```typescript
// 启动时过滤出成功翻译的节点
const successfulNodes = nodes.filter(node => {
  const displayNode = document.querySelector(`[data-translate-docx-id="${node.id}"]`)
  return displayNode && !displayNode.querySelector('.docx-erring') && displayNode.querySelector('font')
})
```

**2. 暂停/恢复**
```typescript
// 翻译前暂停，防止死循环
manager.pause()  // disconnect 所有 observer

try {
  await translateNodes()
} finally {
  manager.resume()  // 重新 observe
}
```

**3. 增量翻译**
```typescript
// 只翻译受影响的容器
const affectedNodes = sourceTextNodes.filter(node =>
  changedContainers.some(container =>
    container.contains(node.container)
  )
)
```

## API 参考

### MutationObserverManager

```typescript
// 创建实例
const manager = new MutationObserverManager({
  config: {
    containerSelectors: ['.feed'],
    changeDelay: 10
  },
  sourceTextNodes: translationNodes,
  onMutation: (changedContainers) => {
    // 处理变化
  },
  debug: false
})

// 启动监听
manager.start()

// 暂停监听（翻译时使用）
manager.pause()

// 恢复监听
manager.resume()

// 动态添加监听（重试成功后）
manager.addObserversForNodes([newNode])

// 检查状态
manager.isActive()  // 是否有活跃监听器
manager.getObserverCount()  // 监听器数量

// 销毁
manager.destroy()
```

### 回调参数

```typescript
onMutation: (changedContainers: HTMLElement[]) => void | Promise<void>
```

**changedContainers**: 发生变化的容器元素数组，用于增量翻译

## 使用场景

### 场景 1：单页应用（SPA）

```json
{
  "id": "twitter",
  "matches": ["twitter.com", "x.com"],
  "mutationObserverContainerSelectors": ["[data-testid='primaryColumn']"],
  "mutationChangeDelay": 500
}
```

### 场景 2：实时聊天

```json
{
  "id": "discord",
  "matches": ["discord.com"],
  "mutationObserverContainerSelectors": ["[class*='messages-']"],
  "mutationChangeDelay": 10
}
```

### 场景 3：无限滚动

```json
{
  "id": "reddit",
  "matches": ["reddit.com"],
  "mutationObserverContainerSelectors": ["shreddit-feed"],
  "mutationChangeDelay": 300
}
```

## 特殊处理

### 翻译失败处理

**问题：** 翻译失败的节点不应该被监听

**解决：**
```typescript
// 启动时过滤失败节点
const successfulNodes = filterSuccessfulNodes(sourceTextNodes)

// 重试成功后动态添加监听
onRetrySuccess: (nodeId) => {
  const node = findNode(nodeId)
  manager.addObserversForNodes([node])
}
```

### 防止死循环

**问题：** 翻译操作修改 DOM → 触发监听 → 再次翻译 → 死循环

**解决：** 使用暂停/恢复机制
```typescript
manager.pause()     // disconnect，丢弃队列
try {
  await translate()  // 修改 DOM，但不触发回调
} finally {
  manager.resume()   // 重新 observe
}
```

### 文本更新

**问题：** DOM 变化后，originText 可能过时

**解决：** 重新提取文本
```typescript
// 变化时重新提取文本
const refreshedNode = {
  ...node,
  originText: extractTextFromDOM(node.textNodes)
}

// 检查是否需要翻译
if (cachedTranslation !== refreshedNode.originText) {
  await translate(refreshedNode)
}
```

## 调试

启用调试模式查看详细日志：

```typescript
const translator = new ImmersiveTranslator({
  debug: true,
  // ...
})
```

**日志示例：**
```
[MutationObserverManager] 启动 DOM 变化监听...
[MutationObserverManager] 过滤失败节点: node-5
[MutationObserverManager] 已为 18 个成功翻译的源节点容器创建监听器 (过滤了 2 个失败节点)
[MutationObserverManager] 额外监听了 1 个全局容器选择器
[MutationObserverManager] 总共创建 19 个监听器
[MutationObserverManager] 检测到 3 个容器发生变化，触发重新翻译
[MutationObserverManager] 监听已暂停，所有 observer 已断开
[MutationObserverManager] 监听已恢复，所有 observer 已重新连接
```

## 最佳实践

1. **精确指定容器**
   ```json
   // ✅ 好：指定具体容器
   "mutationObserverContainerSelectors": [".timeline", ".feed"]

   // ❌ 差：监听整个 body
   "mutationObserverContainerSelectors": ["body"]
   ```

2. **合理设置延迟**
   - 快速更新（聊天）：10ms
   - 中等更新（Feed）：100-500ms
   - 慢速更新（文章）：500-1000ms

3. **避免冲突**
   - 确保翻译节点不在监听的容器内部
   - 使用 `data-translate-docx-id` 标记已翻译内容

## 性能优化

- **防抖机制**: 合并短时间内的多次变化
- **智能过滤**: 只监听成功翻译的节点
- **增量翻译**: 只翻译受影响的容器
- **暂停/恢复**: 避免翻译时的无效触发
- **自动清理**: 销毁时断开所有 observer

## 故障排查

**问题：DOM 变化了但没有触发翻译**
- 检查容器是否在 `mutationObserverContainerSelectors` 中
- 确认节点翻译成功（没有 `.docx-erring` 错误标记）
- 启用 debug 模式查看日志

**问题：翻译陷入死循环**
- 检查是否正确使用了 pause/resume
- 确认翻译节点没有在被监听的容器内

**问题：重复翻译相同内容**
- 检查缓存是否正常工作
- 确认 `refreshNodeText` 正确提取了新文本

## 总结

MutationObserverManager 提供了完整的 DOM 监听解决方案，通过智能过滤、防抖机制和暂停/恢复功能，确保高效、可靠的动态内容翻译。

**适用场景：**
- ✅ 单页应用（SPA）
- ✅ 无限滚动列表
- ✅ 实时聊天/评论
- ✅ 动态加载内容
- ✅ Ajax 更新页面

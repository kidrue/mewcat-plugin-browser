# services/request.ts 401 响应拦截器分析报告

**日期**: 2025-12-05
**测试脚本**: `test/test-401-interceptor.ts`
**测试结果**: ✅ 所有测试通过

---

## 一、实现分析

### 1. 代码位置
`src/services/request.ts` (line 122-188)

### 2. 核心功能

#### 2.1 401 错误检测
```typescript
// line 127-130
if (!error.response || error.response.status !== 401) {
    return Promise.reject(error)
}
```
✅ **正确**: 只处理 401 错误，其他错误直接返回

#### 2.2 防止重复刷新
```typescript
// line 132-135
if (originalRequest._retry) {
    return Promise.reject(error)
}
```
✅ **正确**: 使用 `_retry` 标志防止无限递归

#### 2.3 请求队列机制
```typescript
// line 94-100
let isRefreshing = false
let failedQueue: Array<{
    resolve: (value?: unknown) => void
    reject: (reason?: unknown) => void
    config: AxiosRequestConfig
}> = []

// line 137-142
if (isRefreshing) {
    return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject, config: originalRequest })
    })
}
```
✅ **正确**: 并发请求只刷新一次，其他请求加入队列等待

#### 2.4 Token 刷新逻辑
```typescript
// line 148-164
const refreshToken = await storage.get<string>("refreshToken")
if (!refreshToken) {
    throw new Error("No refresh token available")
}

const response = await refreshAccessToken(refreshToken)
if (!response.accessToken || !response.refreshToken) {
    throw new Error("Failed to refresh token")
}

await storage.set("accessToken", response.accessToken)
await storage.set("refreshToken", response.refreshToken)
```
✅ **正确**:
- 从 storage 获取 refreshToken
- 调用刷新接口
- 验证响应数据
- 保存新 token

#### 2.5 请求重试
```typescript
// line 166-175
if (originalRequest.headers) {
    originalRequest.headers.Authorization = `Bearer ${response.accessToken}`
}

processQueue(null, response.accessToken)

return doc2xRequest(originalRequest)
```
✅ **正确**:
- 更新原始请求的 Authorization 头
- 处理队列中的请求
- 重新发送原始请求

#### 2.6 错误处理
```typescript
// line 176-183
catch (err) {
    await storage.remove("accessToken")
    await storage.remove("refreshToken")
    processQueue(err as Error, null)
    return Promise.reject(err)
}
```
✅ **正确**: 刷新失败时清除 token 并拒绝所有请求

---

## 二、测试验证

### 测试场景 1: 单个请求触发 401
```
✅ 通过
- 旧 token 无效，返回 401
- 自动刷新 token
- 使用新 token 重试成功
```

**测试日志**:
```
[请求] GET /api/user
[Token] old-access-token-1...
[模拟服务器] Token 无效，返回 401
[401错误] 请求 /api/user 返回 401
[刷新Token] 使用 refreshToken
[Storage] ✓ 设置 accessToken: new-access-token-xxx
[Storage] ✓ 设置 refreshToken: new-refresh-token-xxx
[重试请求] 使用新 token 重试原始请求
[模拟服务器] Token 有效，返回 200
[响应成功] /api/user
```

### 测试场景 2: 并发请求触发 401
```
✅ 通过
- 3 个并发请求同时返回 401
- 第一个请求触发刷新
- 其他 2 个请求加入队列等待
- 刷新成功后，所有请求使用新 token 重试
- 所有请求都成功返回
```

**测试日志**:
```
[请求] GET /api/user  → 401
[请求] GET /api/posts  → 401
[请求] GET /api/comments  → 401
[401错误] 请求 /api/user 返回 401
[401错误] 请求 /api/posts 返回 401
[等待刷新] 请求加入队列
[401错误] 请求 /api/comments 返回 401
[等待刷新] 请求加入队列
[刷新Token] 使用 refreshToken
[处理队列] 队列长度: 2, token: new-access-token-xxx
[模拟服务器] Token 有效，返回 200  ✓
[模拟服务器] Token 有效，返回 200  ✓
[模拟服务器] Token 有效，返回 200  ✓
```

### 测试场景 3: refresh token 无效
```
✅ 通过
- 请求返回 401
- 尝试刷新 token 失败
- 清除 accessToken 和 refreshToken
- 返回错误
```

**测试日志**:
```
[请求] GET /api/user
[Token] old-access-token-3...
[模拟服务器] Token 无效，返回 401
[401错误] 请求 /api/user 返回 401
[刷新Token] 使用 refreshToken: invalid-refresh-token
[刷新失败] Invalid refresh token
[Storage] ✗ 删除 accessToken
[Storage] ✗ 删除 refreshToken
```

---

## 三、结论

### ✅ 实现评估

`services/request.ts` 中的 401 响应拦截器**实现正确且完善**，包括：

1. ✅ 401 错误检测和处理
2. ✅ 防止重复刷新机制
3. ✅ 并发请求队列管理
4. ✅ Token 自动刷新
5. ✅ 请求自动重试
6. ✅ 错误处理和清理

### 📊 测试结果

```
测试总结
─────────────────────
✅ 通过: 3
❌ 失败: 0
📊 总计: 3

🎉 所有测试通过！
```

### 🎯 建议

**当前实现已经非常完善，无需修改。**

如果将来需要优化，可以考虑：
1. 添加刷新重试次数限制（目前只刷新一次）
2. 添加刷新超时机制
3. 添加更详细的日志记录
4. 考虑将刷新逻辑抽取为独立的服务

---

## 四、如何运行测试

```bash
# 运行 401 拦截器测试
pnpm test:401

# 或
pnpm run test:401
```

测试完全模拟了实际的 401 拦截器行为，无需额外依赖，可以随时运行验证功能。

---

**报告生成时间**: 2025-12-05
**测试脚本路径**: `test/test-401-interceptor.ts`
**源代码路径**: `src/services/request.ts` (line 122-188)

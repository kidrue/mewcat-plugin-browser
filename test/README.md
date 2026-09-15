# 测试目录说明

## 扩展功能人工验收

运行 `pnpm example`，使用已加载 mewCat 的 Chrome 打开 <http://127.0.0.1:4173>。
页面提供沉浸式翻译、划词、多语言、动态内容、图片翻译和页面总结素材，以及人工验收勾选。
完整步骤与记录模板见 [example/README.md](../example/README.md)。

## 按阅读范围翻译验收

设置入口：基础设置 → 阅读翻译 → 按阅读范围翻译，默认关闭。

自动回归（也已纳入 `pnpm check`）：

```bash
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/viewport-translation-scheduler.test.ts test/viewport-translation.test.ts
```

真实浏览器几何验收：运行 `pnpm exec vite --config test/vite.viewport.config.ts`，打开 <http://127.0.0.1:5178/viewport-translation.html> 并点击“运行浏览器验收”。该页面使用生产调度器和模拟翻译响应，不消耗第三方 API 额度；覆盖三屏边界、快速滚动暂停、停下后补译、内部容器尺寸变化和销毁清理。

2026-09-15 验证记录：27 项调度及集成测试、5 项真实浏览器验收、完整 `pnpm check` 和本地生产构建通过。审查发现的同文本节点重建、已删除原文残留任务、缓存等待期间过期结果渲染均已加入回归测试。

## 目录结构

```
test/
├── README.md                    # 本文件：测试目录说明
├── test-rpc.ts                  # gRPC/Connect RPC 测试（Node.js）
├── test-rpc.html                # gRPC/Connect RPC 测试（浏览器版）
├── test-server.mjs              # RPC 测试开发服务器
├── test-401-interceptor.ts      # 401 响应拦截器测试 ✨ NEW
├── test-token-refresh.ts        # Token 刷新机制测试（需要额外依赖）
├── test-token-refresh.html      # Token 刷新测试（浏览器版）
└── archive/                     # 已归档的测试文件
    └── web3-test.js             # Web3 连接测试（已停用）
```

## 测试文件说明

### 1. RPC 调用测试

**test-rpc.ts** - gRPC/Connect RPC 测试（命令行）
- 测试 ChatService 的 completion 方法
- 使用 @connectrpc/connect 和 @connectrpc/connect-web
- 连接到开发环境 API: `https://api-dev.doc2x.noedgeai.com`
- 测试场景：
  - 调用 completion API 进行翻译

运行方式：
```bash
pnpm test:rpc
```

**test-rpc.html** - gRPC/Connect RPC 测试（浏览器可视化）
- 可视化测试界面，支持配置和实时查看结果
- 支持测试两个接口：
  - Completion 测试
  - CommonTranslate 测试
- 功能：
  - 配置 API 端点
  - 选择模型（DEEPSEEK_CHAT、GLM4_PLUS、DOUBAO_1d5_PRO）
  - 调整温度参数
  - 实时日志输出

运行方式：
```bash
pnpm test:rpc:web
# 自动在浏览器中打开 http://localhost:3333
```

**test-server.mjs** - 开发服务器
- 为 test-rpc.html 提供本地服务器
- 端口：3333
- 自动打开浏览器
- 支持 CORS

---

### 2. Token 刷新测试

**test-401-interceptor.ts** - 401 响应拦截器测试 ✨ **推荐使用**
- **完全模拟** `src/services/request.ts` 中的 401 拦截器实现
- **无需额外依赖**，使用 Node.js 内置功能和 axios
- 测试场景：
  1. ✅ 单个请求触发 401，自动刷新 token
  2. ✅ 多个并发请求触发 401，只刷新一次 token
  3. ✅ refresh token 无效，清除 token 并返回错误
- 状态：**所有测试通过** ✅

运行方式：
```bash
pnpm test:401
# 或
pnpm run test:401
```

---

**test-token-refresh.ts** - Token 刷新机制测试（旧版）
- 测试 `src/services/request.ts` 中的 401 响应拦截器
- 验证 token 自动刷新机制
- 测试场景：
  1. 单个请求触发 401，自动刷新 token
  2. 多个并发请求触发 401，只刷新一次 token
  3. refresh token 无效，清除 token 并返回错误
- 依赖：`axios-mock-adapter`（需要安装）

当前状态：需要安装 `axios-mock-adapter` 才能运行

**test-token-refresh.html** - Token 刷新测试（浏览器可视化）
- 可视化模拟 token 刷新流程
- 包含完整的测试场景模拟
- 实时显示 Storage 状态
- 详细的日志输出

运行方式：
直接用浏览器打开 test-token-refresh.html 文件

---

### 3. 已归档测试

**archive/web3-test.js** - Web3 连接测试
- 原因：项目已移除 web3 依赖
- 内容：测试 Sepolia 测试网连接
- 状态：已停用
- 功能：
  - 连接到 Sepolia 测试网
  - 获取网络信息、区块号、Gas 价格
  - 创建测试账户
  - 查询地址余额

如需恢复此测试，需要重新安装 web3 依赖：
```bash
pnpm add -D web3
```

---

## 如何运行测试

### 运行 RPC 测试（命令行）
```bash
pnpm test:rpc
```

### 运行 RPC 测试（浏览器）
```bash
pnpm test:rpc:web
# 或
pnpm run test:rpc:web
```

### 运行 401 拦截器测试 ✨ 推荐
```bash
pnpm test:401
# 或
pnpm run test:401
```

### 运行 Token 刷新测试
由于需要额外依赖，暂时未添加到 package.json，可以：
1. 安装依赖：`pnpm add -D axios-mock-adapter`
2. 运行：`npx tsx ./test/test-token-refresh.ts`
3. 或直接打开 HTML 版本

---

## 测试维护说明

### 添加新测试
1. 在 test/ 目录下创建测试文件
2. 命名规范：`test-<功能名>.ts` 或 `test-<功能名>.html`
3. 在本 README.md 中添加说明
4. 在 package.json 的 scripts 中添加快捷命令

### 归档测试
当测试不再适用或依赖已移除时：
1. 将文件移至 `test/archive/` 目录
2. 在本 README.md 中标注归档原因
3. 从 package.json 中移除相关脚本

---

## 注意事项

1. **API Token**: test-rpc.ts 中包含测试用的 Bearer Token，仅用于开发测试
2. **环境要求**:
   - Node.js 版本：建议使用项目指定版本
   - 包管理器：强制使用 pnpm
3. **Mock 依赖**: token 刷新测试需要 `axios-mock-adapter`，暂未添加到项目依赖中
4. **浏览器测试**: HTML 测试文件可直接在浏览器中打开，或通过本地服务器访问

---

## 相关文档

- [Connect RPC 文档](https://connectrpc.com/docs/web/getting-started)
- [Axios 拦截器文档](https://axios-http.com/docs/interceptors)
- [项目 API 文档](https://api-dev.doc2x.noedgeai.com)

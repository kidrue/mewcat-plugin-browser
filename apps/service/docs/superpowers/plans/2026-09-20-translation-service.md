# 翻译服务 Implementation Plan

> 执行方式：按 superpowers:executing-plans 在当前会话连续实现，完成后独立审查。用户已授权本任务范围内的常规操作，不逐阶段请求确认。

**Goal:** 实现可运行的硅基流动翻译服务和浏览器加密客户端。

**Architecture:** Fastify 路由委托加密、身份与限额、供应商三个边界模块；Prisma SQLite 负责持久化。共享协议模块仅依赖 Web Crypto 与 JOSE，可供浏览器复用。

**Tech Stack:** Node.js >=22.12、TypeScript、Prisma 7、Fastify 5、jose 6、Zod、Vitest。

**Spec:** ../specs/2026-09-20-translation-service-design.md

## Global Constraints

- 不提交密钥、数据库或 .env；不调用真实收费 API。
- 原文/译文不持久化，不开放任意模型、提示词和上游地址。
- 所有设计、运行说明使用简体中文；不自行提交或发布项目。

## Review Focus

1. 同时到达的相同 nonce 只有一个请求能调用供应商。
2. 临近时间容差上界的 nonce 在请求仍有效时不能被清理。
3. 并发限额检查和扣减不可分离，多维扣减必须整体回滚。
4. 上游返回截断、数量不匹配或无效 JSON 不得被视为有效译文。
5. 客户端必须验证响应签名、请求 nonce 和业务结构，拒绝被调换的响应。

## Task 1: 协议与工程基础

文件：package.json、tsconfig.json、src/protocol.ts、tests/protocol.test.ts。

接口：createIdentity()、seal()、open()、readSigned()；JWS 负载为包含 v、method、path、timestamp、nonce、data 的对象。

- [x] 先写真实密钥往返、篡改、错误接收方、过期/路由绑定测试，运行 `npm test -- tests/protocol.test.ts` 记录失败。
- [x] 实现强制 ES256、RSA-OAEP-256/A256GCM 与严格 schema 校验，再运行同一测试。

## Task 2: 数据和防滥用

文件：prisma/schema.prisma、prisma.config.ts、src/store.ts、src/config.ts、tests/store.test.ts。

接口：createStore(databaseUrl)、registerClient()、consumeNonce()、reserveUsage()、getUsage()、cleanup()。

- [x] 写真实临时 SQLite 的邀请码单次消费、nonce 并发冲突、限额事务回滚和窗口过期测试；运行 `npm test -- tests/store.test.ts`。
- [x] 实现迁移、事务额度计数和客户端撤销，验证上述测试。

## Task 3: HTTP 与硅基流动

文件：src/app.ts、src/provider.ts、src/server.ts、tests/app.test.ts、tests/provider.test.ts。

接口：buildApp({config,store,keys,fetch})；translate({texts,sourceLanguage,targetLanguage})。

- [x] 使用 Fastify inject 和真实加密编写端到端拒绝/成功用例；供应商测试只替换网络 fetch。
- [x] 实现注册、翻译、用量、健康检查、公钥路由及上游超时/输出校验。
- [x] 运行全套 `npm test`，包括并发重放、封禁、额度耗尽、跨路由请求和供应商异常。

## Task 4: 客户端与交付

文件：client/index.ts、client/storage.ts、scripts/admin.ts、README.md、.env.example、Dockerfile、compose.yaml。

- [x] SDK 使用真实服务集成测试，拒绝响应错配，验证错误响应与不可导出私钥。
- [x] 完成启动脚本、管理 CLI、部署和扩展接入示例。
- [x] 执行 `npm run typecheck`、`npm run build`、`npm test`、真实迁移和 CLI 启动冒烟验证。
- [x] 复核安全边界，独立审查后修复实质问题并重新验证。

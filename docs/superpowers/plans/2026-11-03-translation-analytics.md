# 翻译调用留存与画像实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 保存接口事实与加密翻译内容，通过持久化后台任务生成可查询、可导出的行为和内容画像。

**Architecture:** 复用 Fastify、Prisma 和 SQLite。请求链路事务保存事实，分析 worker 通过租约领取任务，模型结果与画像聚合同事务提交；管理员通过 CLI 查询、导出、重试和清除。

**Tech Stack:** Node.js 22.12+、TypeScript、Fastify、Prisma 7、SQLite、Zod、Vitest、node:crypto。

**Spec:** `docs/superpowers/specs/2026-11-03-translation-analytics-design.md`（用户已确认）。

## Global Constraints

- 保持已发布扩展的公共协议、设备身份、额度和加密响应兼容。
- 行为统计默认启用；内容采集和自动分析默认关闭，启用采集必须有专用 32 字节密钥。
- 内容保留 30 天，调用及分析明细 90 天，日聚合 365 天；全部可配置。
- 分析并发 1，最多 3 次尝试，每 UTC 日 100 次尝试、50,000 UTF-16 输入单元，跨重启保存预算。
- 不部署、不调用付费 API、不输出真实凭据；测试使用临时数据库、假密钥和模拟供应商。
- 使用简体中文说明与提交信息；不修改用户已有扩展工作；完成后保留可审查改动，不自动 push。

## Review Focus

- 签名不通过的 signerId 不得绑定设备；注册幂等复用真实 clientId。
- 最终 HTTP 失败与已成功上游调用不能混为同一执行状态。
- 租约过期后旧 worker 不得提交结果；清除与在途分析竞争不能复活画像。
- 清理原始记录后日汇总仍可查询；时间窗口不足明确返回覆盖信息。
- 同内容重复调用增加行为量，但同设备同日同版本兴趣只贡献一次。

### Task 1: 数据模型、配置与内容加密

**Files:** `apps/service/prisma/schema.prisma`、新 migration、`src/config.ts`、`src/analytics/content.ts`、`tests/analytics-content.test.ts`、`tests/analytics-store.test.ts`。

**Interfaces:** 内容模块输出 `createContentCipher(key)`，提供 `encrypt(requestId, kind, texts)`、`decrypt(requestId, kind, ciphertext)`、`digest(texts)`；Store 暴露串行事务方法供 analytics 使用。配置新增采集/分析开关、密钥、预算、保留期、轮询与超时。

- [x] 先写配置与加密行为测试：默认关闭、无效密钥拒绝、AAD 防串用、随机 nonce、摘要规范化与密文无明文。
- [x] 运行上述测试确认失败，再实现配置、加密与兼容迁移；计数使用 BigInt 或等价安全方案，新增字段允许旧记录未知。
- [x] `pnpm --filter @mewcat/service db:generate`；运行新测试及已有 store 测试，验证迁移旧库数据。

### Task 2: 持久化调用、翻译内容与长期聚合

**Files:** `src/analytics/store.ts`、`src/store.ts`、`src/app.ts`、`tests/analytics-store.test.ts`、`tests/analytics-app.test.ts`。

**Interfaces:** `AnalyticsStore` 包装现有 `Store`；提供调用最终记录、内容保存、任务创建、查询和清理方法；`buildApp` 通过已验证请求上下文关联设备，调用最后状态在 `onResponse` 落库。

- [x] 用真实 SQLite 与真实协议测试成功、401、403、409、429、参数失败、注册幂等、供应商失败，以及关闭采集与密文内容。
- [x] 运行确认新行为缺失，再接入所有已知路由的调用事实；调用 ID 唯一并与日/时段/错误/语言聚合同事务保存，缺失 clientId 不伪造归属。
- [x] 翻译原文与预占额度同事务创建；最终内容、状态和任务同事务写入，完成操作幂等；原始删除不级联删除聚合。
- [x] 测试重复完成、内容到期、聚合长期留存及所有已有 app/feedback/ingress 测试。

### Task 3: 持久化主题任务与模型分析

**Files:** `src/analytics/analyzer.ts`、`src/analytics/worker.ts`、`src/analytics/store.ts`、`src/server.ts`、`tests/analytics-worker.test.ts`。

**Interfaces:** `createAnalyzer(config, fetcher)` 校验受控主题响应；`runAnalysisBatch(analytics, analyzer, options)` 有界执行；`startAnalysisWorker` 返回异步停止函数；领取/提交均使用 jobId + leaseToken 条件。

- [x] 测试跨重启租约、过期 worker、预算、超时重试、非法输出、提示注入数据、重复内容、版本隔离、purge 在途竞争、关闭采集/自动分析。
- [x] 运行确认失败，实现数据库领取、租约、尝试预算、退避和最多三次尝试；每次网络调用均计入持久化预算。
- [x] 分析输出包含受控主题、关键词、置信度与采样信息；结果和同设备同日内容去重后的主题聚合同事务提交。
- [x] worker 独立单并发，关闭时取消网络调用并停止领取；失败不影响翻译响应。运行 worker/store 测试。

### Task 4: 管理查询、导出与清除

**Files:** `src/analytics/query.ts`、`scripts/analytics.ts`、`scripts/admin.ts`、`tests/analytics-query.test.ts`、`tests/analytics-cli.test.ts`。

**Interfaces:** CLI 支持 `analytics summary|profile|calls|export|analyze|retry|purge`，过滤使用 UTC 半开时间区间与复合游标；JSON 大整数输出为十进制字符串。

- [x] 先测试无样本、部分保留期、过滤分页、近 7/30 天画像、UTC 时段、错误分布、主题覆盖率和重复主题权重。
- [x] 测试导出默认无内容，显式解密导出、输出路径、分页流式写入；无效 CLI 参数在网络/修改前拒绝。
- [x] 实现查询、JSONL 导出、同预算有界分析、失败重试与按设备删除；purge 不清除额度、nonce 或设备密钥。
- [x] 运行 CLI/query 测试，确认清除后旧任务不能提交，但后续新请求可创建新的画像。

### Task 5: 文档、集成验收与独立审查

**Files:** `.env.example`、`apps/service/README.md`、`apps/service/docs/api.md`、新增 analytics 使用说明、计划进度。

- [x] 说明内容持久化改变、配置开关、内容密钥备份、分析预算、保留周期、仅设备身份、仅后端可见调用、命令用法及实际覆盖率。
- [x] `pnpm format`；检查只保留本任务改动。
- [x] `pnpm build:packages`、`pnpm --filter @mewcat/service check`、`pnpm test:workspace`、`pnpm build:verify service`。
- [x] 依据 spec 逐项验收；安排一次独立代码审查并修复有实质影响的问题，重跑受影响检查；最后报告结果与未执行的环境检查。

## 执行记录

用户已确认设计，后续按仓库规则直接实施，不重复请求常规步骤确认。本次以当前会话直接实施、最终独立审查的方式执行。

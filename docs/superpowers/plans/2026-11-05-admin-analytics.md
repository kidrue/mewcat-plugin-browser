# 管理员分析面板实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 提供签名鉴权的管理员分析接口，以及沿用扩展主题、从作者名称进入的只读分析面板。

**Architecture:** 共享协议定义有界查询与字段白名单响应；后端复用 AnalyticsQuery 和设备签名，以服务端设备白名单授权。扩展仅通过 background 持有 SDK，options 展示真实响应；生产独立服务仓库同步后端变更。

**Tech Stack:** Node.js 22.12+、pnpm 10.20.0、Fastify、Prisma SQLite、Zod、JWE/JWS、WXT React、styled-components。

**Spec:** `docs/superpowers/specs/2026-11-04-admin-analytics-dashboard-design.md`

## Global Constraints

- 保持已发布翻译协议兼容；不增加依赖或付费模型调用。
- `ANALYTICS_ADMIN_CLIENT_IDS` 默认空，去空白去重最多 20 个 UUID；不自动授予任何设备权限。
- `POST /v1/analytics/query` 四个 operation；UTC 半开日期最多 90 天，默认分页 20、最多 100；BigInt 返回字符串。
- 每管理员设备每分钟 60 次，单进程最多 2 个分析查询；不计入翻译画像或额度。
- 页面沿用现有主题和真实素材；无权限只展示本设备 ID；不返回原文、译文、IP、密钥及 nonce。
- 独立工作区保护现有修改；提交信息中文；格式化后执行相关检查，构建不上传 Sentry。

## Review Focus

- 被撤销、非管理员及伪造来源不能读取数据：Task 2 和 Task 3 测试。
- 闰日、非法游标、BigInt 和超大结果不破坏边界：Task 1 和 Task 2 测试。
- 管理读取不自增画像、不消耗翻译预算，查询失败归还并发槽：Task 2 测试。
- 旧请求晚返回不得覆盖新筛选，刷新错误保留准确更新时间：Task 3 测试。
- 部署未指定白名单时保留原值，空值显式禁用；普通用户不因新增管理功能失去翻译能力：Task 4 测试。

### Task 1: 共享分析协议和 SDK

**Files:** 新增 `packages/mewcat-protocol/src/analytics.ts`，修改 `src/index.ts`；修改 `packages/mewcat-client/src/client.ts` 和 `src/index.ts`；测试 `apps/service/tests/analytics-api.test.ts`。

**Interfaces:** 导出 `analyticsQuerySchema`、`analyticsResultSchema`、`AnalyticsInput`、`AnalyticsResult` 和 operation 响应类型。`TranslationClient.queryAnalytics(input: AnalyticsInput, options?: RequestOptions): Promise<AnalyticsResult>` 沿用签名请求。

- [x] 写日期、limit、operation 严格参数、响应字段和 BigInt 字符串的失败测试，并运行确认失败。
- [x] 定义四种输入/响应的严格 schema；增加 SDK 方法并导出。
- [x] 构建共享包，重跑协议测试到通过；提交 `feat(analytics): 定义管理员分析协议与客户端查询`。

### Task 2: 后端管理员查询

**Files:** 新增 `apps/service/src/analytics/admin.ts`；修改 `analytics/query.ts`、`src/app.ts`、`src/config.ts`、Prisma 索引 migration；测试 `apps/service/tests/analytics-api.test.ts`。

**Interfaces:** 消费 Task 1；`AdminAnalytics.query(clientId: string, input: unknown): Promise<AnalyticsResult>` 先鉴权后解析，管理并发和限流。概览只统计 translate，profile 固定近 7/30 天，calls/devices 支持复合游标分页。

- [x] 写加密 HTTP 测试：管理员、非管理员、撤销、签名、防重放、非法日期/游标、分页、字段白名单、不计入画像/额度、限流和并发恢复；运行确认新增功能失败。
- [x] 实现白名单配置、查询投影、严格结果校验和响应大小限制；添加路由，复用已有鉴权并排除管理统计。
- [x] 跑后端 typecheck 与全部测试；提交 `feat(analytics): 增加管理员分析查询接口`。

### Task 3: 扩展隐藏入口和分析页面

**Files:** 新增 `apps/extension/src/types/analytics.ts`、`background/messages/analytics.ts`、`services/analytics.ts`、`options/Analytics.tsx`、`options/analytics/`；修改 About、options index、background index、messaging protocol、background service；新增相应扩展测试。

**Interfaces:** 消费 Task 1 的 schema/types。消息 `analytics-query` 和 `analytics-identity` 返回受控成功/错误 union，仅接受本扩展 options.html sender；UI 不获取 SDK state。

- [x] 写 sender 拒绝、隐藏 hash、作者点击和键盘、未授权 ID、过期请求及分页筛选测试，运行确认失败。
- [x] 接入后台 SDK 和受控错误，构建蓝白主题概览/设备/调用视图、可访问抽屉、SVG 趋势及文本数据，增加加载/空/失败/未上线状态。
- [x] 运行相关扩展测试、typecheck 和 lint；提交 `feat(analytics): 添加扩展管理员分析面板`。

### Task 4: 部署配置和生产服务同步

**Files:** 根 `.env.example`、服务 `scripts/update-runtime-env.ts` 与相关测试、两个部署 workflow、分析文档；生产 `C:/project/mewCat-service` 对应后端与 client/contracts 文件。

**Interfaces:** 环境变量 `ANALYTICS_ADMIN_CLIENT_IDS`；未提供时保留旧配置，显式空串清空。继续由独立服务仓库负责生产部署。

- [x] 写 runtime updater 白名单保留/更新/清空/非法值测试，运行确认失败。
- [x] 实现配置传递、说明和后端同步；检查两仓库差异限定在本任务。
- [x] 执行 pnpm format、共享包构建、后端检查、扩展测试/typecheck/lint、build:verify；独立后端 npm test/typecheck/build；提交中文信息。
- [x] 按执行技能做一次全分支独立审查，修复重要问题并验证；将实际检查与可用产物交付。生产授权只使用用户提供的设备 ID。

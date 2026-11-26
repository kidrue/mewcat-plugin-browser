# 请求并发一次性升级迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 更新版本后将所有用户当前请求并发统一设为 8，仅执行一次，之后保留用户修改。

**Architecture:** 后台启动时将迁移放入现有配置写入队列。使用独立的同步存储键 `request-concurrency-migration: 1` 标记，通过 WXT `storage.setItems` 将配置和标记在同一次 `chrome.storage.sync.set` 中保存，避免旧客户端剥离标记及失败后误判完成。

**Tech Stack:** TypeScript、Chrome MV3、WXT storage、Vitest。

**Spec:** 用户已确认本轮会话中的一次性设为 8 方案；不自动恢复旧值，不发布或推送。

## Global Constraints

- 所有旧值（包括自定义值）第一次统一为 8；配置只修改 `maxRequestsPerSecond`，另存内部迁移标记。
- 后续启动、升级和并发配置写入不覆盖迁移后的用户修改。
- 不打印凭据、不调用付费 API；执行 `pnpm format`、扩展完整检查及 `pnpm build:verify extension`。
- 保留工作区已有的思考模式、默认并发和总结修复，不提交其他会话的变更。

## Review Focus

- 用户已有低于或高于 8 的自定义值都迁移，目标语言及模型配置保留。
- 首次安装和没有配置的用户也记录完成状态，未来修改不会重置。
- Service Worker 重启或重复启动不再次覆盖。
- 同时发生用户设置保存、语言检测写入时不丢失配置。
- 存储写入失败时不留下完成标记，下次可重试。

### Task 1: 一次性迁移与验证

**Files:**
- Modify: `apps/extension/src/background/messages/update-config.ts`
- Modify: `apps/extension/src/entrypoints/background.ts`
- Modify: `apps/extension/src/constants/storage.ts`
- Modify: `apps/extension/test/mocks/imports.ts`
- Test: `apps/extension/test/storage-names.test.ts`
- Modify: `apps/extension/package.json`
- Test: `apps/extension/test/request-concurrency-migration.test.ts`

**Interfaces:** `migrateRequestConcurrency(): Promise<ExtensionConfig>` 与普通更新共用后台队列；独立存储标记为数字，版本大于等于 1 时不重新迁移；开发环境使用 `-dev` 后缀。

- [x] 编写并运行失败测试，覆盖旧值、重复执行、重启、并发写入及失败重试。
- [x] 提取共享配置写入队列入口，添加独立同步标记和迁移逻辑；后台注册监听前排队执行迁移。
- [x] 运行迁移与配置持久化回归测试，加入质量检查脚本。
- [x] 格式化、完整扩展检查、生产构建；复核改动和记录验证结果。

## 执行记录

- 采用当前工作区直接实现，避免隔离时遗漏本轮已验证但尚未提交的默认值与总结修复；只修改本任务文件。
- 迁移目标固定为 8，不引用将来可能变化的默认值，避免后续版本意外重新调整。
- 后台入口在注册监听前排队执行迁移；保持现有后台监听模块职责，便于独立验证启动顺序。
- 审查发现配置内标记可能被旧版客户端剥离；已用失败测试复现，改为独立同步键，同一区域批量写入。该调整保留用户已确认的行为，无需新的产品选择。
- 已完成：迁移、持久化、schema 与存储命名共 55 项测试通过；工作区 4 项测试通过；只读审查复查未发现新的可行动问题。
- 最终验证：`pnpm format`、`pnpm --filter @mewcat/extension check`、`pnpm test:workspace`、`pnpm build:verify extension` 全部退出码 0；迁移专测 11/11 通过。未发布、未推送、未调用付费 API。

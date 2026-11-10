# mewCat 智能上下文与段落悬浮提示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 内置 mewCat 翻译能使用上下文，段落悬浮提示支持默认关闭的独立开关。

**Architecture:** 沿用配置、MV3 消息、SDK 和加密翻译接口；context 是可选的限长参考文本。段落提示由独立布尔值控制，保留快捷键监听。

**Tech Stack:** TypeScript、React、Jotai、Zod、Fastify、Vitest。

**Spec:** `docs/superpowers/specs/2026-11-10-translation-context-preview-design.md`

## Global Constraints

- Node.js 22.12+、pnpm 10.20.0；不新增依赖或浏览器权限。
- 上下文至多 2000 个 UTF-16 字符，后端先更新，不自动部署。
- 保留已有未提交修改，不提交或回退用户的工作。
- 不调用付费 API，执行 `pnpm format` 及相关检查。

## Review Focus

- 旧配置缺失新字段时默认关闭，仍可使用段落快捷键。
- 提示开启后关闭或卸载时不存在残留 DOM。
- 上下文开关关闭不发送 context；开启的各个批次携带相同上下文。
- 缓存读取、写入和刷新使用相同上下文，开关变更重新翻译。
- 旧客户端请求兼容、拒绝超长上下文、用量包含上下文且不产生额外译文。

### Task 1: 段落提示独立开关

**Files:** `apps/extension/src/types/{config,extensionConfigSchema}.ts`、`state/constants.ts`、`options/Basic.tsx`、`contents/TranslationControlCenter.tsx`、`translation/paragraphShortcut.ts`；对应 paragraph-shortcut、options-basic-page-summary、extension-config-validation 测试。

**Interfaces:** `enableParagraphHoverPreview?: boolean`；`installParagraphShortcut(shortcut, onTranslate, showPreview = false)`。

- [x] 写测试：默认无提示仍可快捷键翻译、显式开启有提示、设置开关持久化、旧配置默认 false。
- [x] 运行测试观察预期失败。
- [x] 实现配置与显示控制，配置更新时清理旧监听及提示。
- [x] 运行上述测试，预期全部通过。

### Task 2: mewCat 上下文贯通

**Files:** `packages/mewcat-protocol/src/contracts.ts`、`packages/mewcat-client/src/client.ts`、`apps/service/src/{provider,app}.ts`、扩展翻译/请求类型、mewcat-service、两个配置界面和 `ImmersiveTranslator.ts`；测试覆盖 service provider/client、extension translation-service、paragraph-translation、settings-panel-page-summary。

**Interfaces:** 翻译请求增加 `context?: string`；`TranslationCallOptions.context?: string`；共享 `isTranslationContextAvailable(config)` 判断界面可用性；从会话原文生成稳定的上下文快照并复用缓存的 context 维度。

- [x] 写测试：mewCat 无自配模型也可打开开关；请求携带限长 context；关闭时缺省；后端校验及计量；会话更新和缓存隔离。
- [x] 运行测试观察预期失败。
- [x] 实现共享协议、SDK、后端及扩展透传，按上下文隔离缓存。
- [x] 重建共享包并执行相关测试，预期全部通过。

### Task 3: 验证和审查

- [x] 运行 `pnpm format`，核对 diff 不覆盖已有改动。
- [x] 运行 `pnpm check`、`pnpm build:verify`，记录环境限制或已有失败。
- [x] 审查新配置默认、上下文数据流、缓存一致性、兼容性及旧行为回归。

## 执行记录

- 已确认方案，直接执行，不再次询问实施方式。
- 在现有工作目录建立任务分支，保留本地未提交修改及依赖；不创建额外 worktree、不自动提交。
- Task 1: complete。默认提示和设置入口测试先失败，修复后相关配置与交互测试通过。
- Task 2: complete。上下文透传、界面开关和服务协议测试先失败，修复后扩展相关 135 项、服务相关 17 项通过；进一步增加真实 L1 缓存的开关隔离与刷新测试并通过。
- 全量 `pnpm check` 和 `pnpm build:verify` 已通过；服务测试 142 通过、4 项 Docker Compose 测试因本机无相应环境跳过。
- 独立只读审查发现编辑区过滤遗漏 `role=textbox`、误删 `contenteditable=false`。两者属于同一选择器边界，后者会丢失整篇只读正文，合并修复。补充回归先观察两项失败，再复用现有 `EDITABLE_SELECTOR`，段落翻译测试 62 项全部通过；最终 `pnpm check` 与 `pnpm build:verify extension` 均以 exit 0 通过，无剩余审查问题。
- 审查范围说明：第三方模型既有摘要功能未重构，真实上游翻译质量未调用付费 API 验证；全量检查及构建由主执行者完成。
- 后续用户要求提交新版本：扩展版本升级至 `1.1.10`，相关 54 项测试、格式检查和 `pnpm build:verify extension` 通过，构建产物 manifest 版本已核对。仅提交本任务文件，保留其他工作区内容，不自动推送或部署。

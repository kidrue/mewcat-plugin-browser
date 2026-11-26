# 网页自动角色与专家扩充 Implementation Plan

> **For agentic workers:** 使用 superpowers:executing-plans 在当前会话逐项执行。

**Goal:** 增加 12 个专家角色，以及默认关闭的本地网页自动角色选择。

**Architecture:** 独立纯函数根据 URL、标题、描述解析角色。普通翻译服务逐次解析；沉浸式引擎每次开始会话时解析并在运行配置保存实际角色，使请求与缓存一致。

**Tech Stack:** TypeScript、React、Jotai、Zod、Vitest，复用现有依赖。

**Spec:** `docs/superpowers/specs/2026-11-03-auto-ai-role-design.md`

## Global Constraints

- 默认关闭，保留现有枚举值和手动配置；不新增权限、依赖或额外 AI 请求。
- 不覆盖工作区已有改动；不提交、不发布。
- 修改代码后执行 `pnpm format`，使用 `build:verify` 避免上传 Sentry。

## Review Focus

- 伪装域名和带匹配词的查询参数不应触发网站规则。
- URL 无法匹配站点且标题/描述无法识别时，回退手选角色；可识别元数据仍允许独立匹配。
- 网站优先级高于标题领域；论文站点保持学术角色。
- SPA 新会话和配置切换使用新角色，缓存不串用。
- 旧配置无开关字段时保持原行为；总结与概念解释不受影响。

### Task 1: 角色列表与网页解析

**Files:** `src/types/config.ts`、`src/constants/aiRole.ts`、新增 `src/translation/pageAiRole.ts`、`test/page-ai-role.test.ts`（路径相对扩展）。

**Interfaces:** `PageRoleContext` 提供可选 url/title/description；`resolvePageAiRole(config, context?): AiRole` 消费 aiRole/enableAutoAiRole；`readPageRoleContext(): PageRoleContext` 只读取当前网页元数据。

- [x] 添加失败测试：12 个新角色有选项及提示词；关闭保持手选；域名边界、网站优先、元数据识别、未知回退。
- [x] 运行 Vitest 确认失败，再实现并确认通过。

### Task 2: 配置、UI 与普通翻译

**Files:** `src/state/constants.ts`、`src/types/extensionConfigSchema.ts`、`src/options/TranslateServices.tsx`、`src/translation/translationService.ts`、相关测试。

**Interfaces:** `enableAutoAiRole?: boolean` 向后兼容；`TranslationCallOptions.pageContext?: PageRoleContext` 支持显式网页上下文和无 DOM 测试。

- [x] 添加失败测试：配置缺省与持久化、普通及批量翻译请求选用实际角色、关闭回退手选。
- [x] 接入默认值、校验和开关，复用 Task 1 解析器；只影响普通翻译。
- [x] 运行新增及现有翻译与配置相关测试。

### Task 3: 沉浸式翻译、缓存与导航

**Files:** `src/translation/ImmersiveTranslator.ts`、`src/contents/TranslationControlCenter.tsx`、相关测试。

**Interfaces:** 引擎保存手选配置，每次新会话解析为运行时 aiRole；现有缓存统一消费运行时角色。

- [x] 添加失败测试：网页实际角色对应请求与缓存、导航换角色、关闭恢复手选、旧请求不写入新会话。
- [x] 构造及配置更新时解析角色，整页和段落会话开始前刷新，复用现有会话清理。
- [x] 运行相关回归；运行格式化、检查和验证构建；复核差异。

## 执行记录

- 用户授权后在现有工作区实现，保留并行工作已有修改；不额外建立 worktree，不执行提交。
- Task 1/2/3 共享接口已核对：解析配置字段统一为 `enableAutoAiRole`，元数据统一为 `PageRoleContext`。
- Task 1 首轮 32 测试通过；Task 2 配置/UI/调用回归 117 测试通过。
- 审查发现角色变化时多段落重启会被旧 session 检查截断；回归先复现为 2 段只请求 1 段，再将角色刷新移动到 session 快照前，相关 6 文件 106 测试通过，独立审查复核通过。
- `pnpm format` 已执行；首轮全量检查停在新增站点专名的 CSpell 词典检查，词典补齐后重跑全量检查。
- 最终 `pnpm check` 与 `pnpm build:verify` 均退出 0；ESLint 无错误，保留项目现有规则下的警告；`git diff --check` 通过。
- 独立审查的 P2 问题已修复并复核通过。验证日志归档至 `.superpowers/auto-ai-role/`。
- 本机没有 Docker CLI，未执行 Docker 专属验收；服务端测试有 4 项环境相关跳过。未提交、未发布。

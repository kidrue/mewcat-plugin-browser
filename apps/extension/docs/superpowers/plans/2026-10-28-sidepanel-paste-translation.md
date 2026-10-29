# 侧边栏粘贴自动翻译实施计划

> **For agentic workers:** 使用 superpowers:executing-plans 在当前会话执行；用户已确认设计，无需再次确认常规实现和验证。

**Goal:** 原生文本粘贴及侧边栏粘贴按钮自动翻译最终全文，兼容 macOS 与 Windows。

**Architecture:** 保留 textarea 原生插入行为，`paste` 后下一任务读取最终 DOM 值，调用接受明确文本的统一翻译函数。沿用请求版本隔离；取消已过期的粘贴回调与剪贴板读取结果。

**Tech Stack:** React 18、TypeScript、现有 translateText 服务、Vitest / jsdom。

**Spec:** ../specs/2026-10-28-sidepanel-paste-translation-design.md

## 全局约束

- 不新增依赖、权限、后台协议或真实 API 测试调用。
- 普通打字不自动翻译；保留手动翻译、两种系统快捷键与已有错误反馈。
- 输入框粘贴保留原生光标插入、选区替换；粘贴按钮保持替换全文。
- 保留已有工作区修改，本轮不提交、推送或发布。

## 审查重点

- 粘贴后的全文尚未进入 React 状态时不得翻译旧值。
- 相同内容替换、不触发 React onChange 时仍能翻译。
- 连续粘贴、旧译文或剪贴板读取迟到时只接受最新操作。
- 清空、编辑、切换语言或卸载后取消尚未启动的粘贴翻译。
- 无文本/被取消的粘贴不发送请求；空白最终全文不发送请求。

## 任务 1：粘贴自动翻译

文件：`src/sidepanel/index.tsx`、`test/sidepanel-reading.test.tsx`。

- [x] 添加原生粘贴、两种快捷键、右键路径、局部插入/替换、相同值、按钮粘贴、并发隔离和空白回归测试；运行定向 Vitest，确认自动翻译断言失败。
- [x] 抽取 `translateInput(value: string): Promise<void>`，清理旧状态并翻译指定文本；手动按钮保留 loading 检查。
- [x] 添加 `handleTextPaste(event: React.ClipboardEvent<HTMLTextAreaElement>): void`，保留默认粘贴，下一任务读取全文；普通编辑及清空/语言切换/卸载撤销等待的粘贴回调。
- [x] 现有按钮 `handlePaste()` 读到剪贴板后更新全文并调用统一入口；读取期间操作变更使旧读取失效。
- [x] 提示同时说明粘贴自动翻译与 `Ctrl+Enter` / `⌘Enter`。
- [x] 定向测试通过。

## 任务 2：检查与验收

- [x] 执行 `pnpm format`，显式格式化修改的测试与文档。
- [x] 执行 `pnpm --filter @mewcat/extension check`、`pnpm build:verify extension`。
- [x] 独立只读审查；核对实际浏览器原生粘贴行为，使用模拟翻译服务。
- [x] 清理仅换行导致的无关修改并更新设计状态。

## 执行记录

- 设计已获确认，直接在当前工作区实现。

- 2026-10-28：自动粘贴测试已观察到 10 项失败（未触发请求），实现后侧边栏 23 项测试全部通过。
- `pnpm format`、`pnpm --filter @mewcat/extension check` 均退出 0；`test:reading` 共 67 项通过。
- 2026-10-29：`pnpm build:verify extension` 退出 0，独立只读审查无 Critical / Important / Minor 问题。
- Windows Chrome 原生 `Ctrl+V` 实测产生可信 paste / insertFromPaste 事件，每次只发起一次模拟翻译请求；选区替换得到全文 `hello friend`，光标位置保持 12。macOS Cmd+V 及右键路径由跨平台原生粘贴事件测试覆盖，未进行 macOS 实机验收。
- 已保留原有未提交工作，清理仅换行造成的无关修改；未调用真实翻译 API。

# 通用 iframe 翻译实施计划

> **For agentic workers:** 使用 superpowers:executing-plans 在当前会话执行，先失败测试、再实现、最后整体验证。

**Goal:** 开启整页翻译后，当前和延迟加载的 iframe 在其内部复用基础 DOM 规则翻译，覆盖 DailyCal 的跨域 Disqus 评论。

**Architecture:** 采用用户确认的后台按需注入方案。顶层控制器提供当前翻译会话状态，后台通过 `webNavigation` 枚举及监听框架，通过 `scripting` 定向注入无 UI 的运行时；子框架自己加载配置并使用 `ImmersiveTranslator`。后台每次向顶层查询权威状态，不持久化另一份易过期状态，支持 MV3 后台重启。

**Tech Stack:** WXT、Chrome MV3 `webNavigation` / `scripting` / 消息 API、TypeScript、Vitest。

**Spec:** 本会话用户已确认参考陪读蛙的按需注入与通用 DOM 翻译方案，并要求开始执行。

## Global Constraints

- 不新增 DailyCal/Disqus 的 `rule.json` 规则，不覆盖用户既有改动。
- 不在子框架挂载悬浮按钮、设置或划词 UI，不传递配置凭据。
- 新增 `webNavigation` 权限；沿用现有 `scripting` 和 `<all_urls>` 权限。
- 所有框架只响应当前标签页翻译状态；清除、配置重启和源语言切换同步，框架加载失败不影响正文。
- 不提交、不发布，不调用付费 API。

## Review Focus

- 延迟出现的框架、异步评论加载和动态新增评论。
- 清除发生在注入、配置读取或翻译请求未完成时。
- 重复事件、后台重启、框架重新导航与注入幂等。
- 子框架不能改变顶层会话或错误控制其他标签页。
- 仅 iframe 有可翻译内容时仍保持整页会话有效。

### Task 1: 会话协议、后台注入与子框架运行时

**Files:** 新增 `src/translation/frameTranslation.ts`、`src/translation/frameTranslationRuntime.ts`、`src/background/lib/frame-translation.ts`、`src/entrypoints/frame-translate.content.ts`；修改后台注册、WXT 权限和整页控制器。

**Interfaces:** `FrameTranslationState` 包含会话 ID、递增版本、启用状态、源语言、手动标记；顶层响应状态查询，后台响应子框架查询并转发同步通知。

- [x] 增加后台跨域注入、延迟导航、重复注入、拒绝子框架伪造同步的失败测试。
- [x] 实现定向注入及生命周期清理，用顶层状态查询支持后台重启；不跨域访问父页面 DOM。
- [x] 增加子框架启停、慢配置取消、迟到状态、异常响应及动态评论的失败测试。
- [x] 实现独立运行时，复用配置读取和翻译引擎；注入幂等，销毁时清理资源。
- [x] 顶层同步启停/源语言/配置重启，空正文但有 iframe 时保持会话。
- [x] 整页引擎等待 DOM 规则初始化，并验证初始化期间取消不会重新开始。
- [x] 将新增测试加入项目检查命令，执行相关回归。

### Task 2: 验证与交付

- [x] `pnpm format`、`pnpm check`、`pnpm build:verify`。
- [x] 使用真实 DailyCal 页面与受控翻译响应检查 iframe 提取及译文插入，避免付费 API。
- [x] 独立代码审查并修复重要发现，更新验证记录。


## 执行与审查记录

- 三份针对性测试 43 项通过，包含后台导航代次、注入期间清除、设置同步以及空正文等待后加载 iframe。
- 独立审查的三项 Important 均通过先失败后修复的回归用例解决；未发现 Critical，未遗留审查问题。
- 技术选择：后台每次查询顶层权威状态，并绑定顶层导航代次；注入结束后再次查询，避免把旧页面的启用状态带到新页面。
- 技术选择：手动开启后，即使正文暂时没有内容也保持会话，允许未来 iframe 和动态内容加入；用户清除时统一停止。
- 真实 Chrome 隔离配置中加载构建后的扩展，DailyCal 的 Disqus iframe 取得 5 个评论正文、13 段受控译文；本地追加评论段落自动翻译，清除后移除全部译文，子框架悬浮 UI 数量为 0。
- 验收拦截翻译服务请求返回受控响应，真实翻译 API 调用为 0；没有发出评论或其他外部写入。
- 全量检查期间检测到并行新增的自动角色功能；保留其改动，仅为其合法域名/术语补充 14 个拼写词典条目。


## 最终验证

- `pnpm format` 已完成。
- `pnpm check` 最终通过：类型、Lint、格式、拼写、工作区和全部扩展/服务测试通过；iframe 相关检查组为 38 个文件、471 项通过。
- `pnpm build:verify` 最终通过，扩展和服务均完成构建，未上传 Sentry。
- `git diff --check` 通过，保留所有并行改动；本任务未提交或发布。

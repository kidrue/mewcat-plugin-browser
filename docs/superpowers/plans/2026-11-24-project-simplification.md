# mewCat 减法与性能优化计划

> 审阅稿。实施待用户确认。各任务可独立验收和回退，建议用 `superpowers:executing-plans` 逐项执行。

**目标**　在现有功能和用户可见行为保持一致的前提下，清理失效代码和重复维护点，让代码更容易理解、修改和验证。性能收益用于排序，功能等价是每项改动的合入条件。

**技术路线**　沿用 WXT、React、Vitest、Fastify、Prisma 和 SQLite。产物大小、浏览器运行开销和 CI 用时分别取基线。局部调整以现有接口和回归用例为边界。

## 建议范围

| 方案                             | 取舍                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| **推荐：先做行为等价的代码减法** | 首批清理无调用的 DOM 监听代码和重复的测试清单，每项独立验证。                           |
| 在证据充分后局部优化运行路径     | 根据 Chrome 测量选择热点，优先处理能保持原有触发、失败和清理语义的重复计算。            |
| 重组扩展入口和翻译引擎           | 此方案会同时触及 MV3、SPA、iframe、站点规则和缓存，需要更大范围的等价性验证，本轮搁置。 |

第一批预估 0.5–1 个开发日，以可验证的清理为交付范围。第二批是候选，首批验收后再根据测量和回归覆盖决定是否纳入。服务端与设置页的后续改动单独评估。

## 当前证据

| 发现                       | 证据与影响                                                                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 旧 DOM 监听器具备删除条件  | `ImmersiveTranslator.ts` 的 `mutationObserverManager` 初始化为 `null`，生产源码里没有实例化和非空赋值。当前由 `observeBodyChanges()` 监听，扩展文档仍描述旧机制。                                                                  |
| 扩展检查维护多份文件清单   | `check` 间接启动 Vitest 10 次，`test:image` 单独列出 38 个文件，包含 iframe、页面总结和视口翻译。Vitest 能发现 `bailian-token-plan-settings.test.tsx` 与 `model-management.test.ts`，两者均未列入当前 `check`。                    |
| 全站注入可优先减重         | 本机现有 Chrome MV3 1.1.13 产物的 Manifest 声明了 6 个全站脚本，原始 JS 合计 2,838,607 B（2.71 MiB）。其中翻译控制中心约 914 KiB，初始化约 471 KiB。运行时注入的 iframe 脚本另计。数据来自已有产物，表示文件大小，CPU 耗时需重测。 |
| 动态翻译存在重复扫描和排序 | `ImmersiveTranslator.ts` 将相关变更合并到 50 ms 的处理窗口，页面翻译模式下每轮重新提取页面候选。调度器在同一次 `pump()` 的循环里会重复调用 `sortedPending()`，读取候选几何并排序。热点占比需用 Chrome trace 验证。                 |
| 后端画像有可省的查询       | `analytics/query.ts` 的 `profile()` 调用两次 `summary()`，最终只取两段的 `totals`。完整留存区间下，`summary()` 还会计算 p95，涉及计数与可能的排序查询。实际收益取决于数据量和画像请求频率。                                        |

已验证工作区 4 项、扩展 141 项（含上述两个文件的 30 项）、服务端画像查询 3 项。此轮为计划审阅，浏览器 trace、完整 `pnpm check` 和新生产构建安排在实施基线阶段。

## 全局约束

- 使用 Node.js 22.12+、pnpm 10.20.0 和根目录唯一 `pnpm-lock.yaml`，优先复用现有依赖、夹具和脚本。
- 保持现有功能入口、快捷键、默认行为和设置含义。覆盖翻译与总结的触发、成功、失败、取消和重试，以及配置持久化、缓存、还原和升级兼容。保留 MV3 权限、加密协议、设备身份存储及 API 行为。
- 先记录改动前的可复现结果，再用同一夹具与模拟响应运行改动后的验证。优先复用现有测试，只为覆盖缺口补回归。删除代码前核对静态引用、运行时注册、构建入口和手工调用。
- 行为差异、测试覆盖减少、关键场景无法复验时，该项暂缓或回退。代码行数、包体积和耗时都是观测项，功能回归通过后才据此评审改动。
- 生产产物使用 `pnpm build:verify` 验证。测试使用本地夹具和模拟请求，凭据和用户配置按仓库约定处理。
- 修改代码后执行 `pnpm format`，每项运行对应回归，交付时运行 `pnpm check` 和受影响目标的验证构建。若后续涉及容器改动，在 Linux CI 验收并记录本机覆盖范围。
- 实施前记录当前工作区变更。设置页正在调整，后续改动按文件和行为独立评估。

## 第一批：清除废弃代码、收拢检查

### P0.0 记录功能基线

- [ ] 在实施前运行 `pnpm check` 和 `pnpm build:verify extension`，记录退出状态、测试覆盖和已存在的失败。受影响场景有基线失败时，先定位并取得可比较的结果。
- [ ] 使用本地示例页、视口夹具和模拟网络响应，记录首次安装与已有配置升级的关键行为。按改动涉及路径选取场景，沿用相同输入和动作做前后比较。

| 场景                     | 对照结果                                                                       |
| ------------------------ | ------------------------------------------------------------------------------ |
| 网页、段落和 iframe 翻译 | 触发方式、候选与译文顺序、动态新增和替换、关闭后还原、旧请求返回后的页面状态。 |
| 划词、图片和页面总结     | 按钮、快捷键及自动和手动入口可用，首次触发、失败提示、重试或取消符合当前行为。 |
| 设置、存储和缓存         | 已有配置可读，默认值、手动选择、并发保存顺序、重复请求和清理行为一致。         |
| 检查与发布门禁           | 原自动用例及独立脚本仍可执行，生产包在 Chrome 正常加载。                       |

### P0.1 删除旧 DOM 监听器

文件涉及 `apps/extension/src/translation/ImmersiveTranslator.ts`、`MutationObserverManager.ts`、`apps/extension/AGENTS.md` 和 `apps/extension/docs/MutationObserverManager.md`。

- [ ] 复核源码、自动入口、手工示例和文档引用，确认旧类、空字段和配置提取函数在各构建入口均无运行时消费者。
- [ ] 仅删除已证实不可达的旧类、类型导入、空字段、暂停／恢复分支和销毁方法。同步更新相关文档。当前生效的 `observeBodyChanges()`／`stopBodyObserver()` 逻辑及监听条件以基线为准。
- [ ] 运行扩展 `test/viewport-translation.test.ts`、`test/github-dom-selection.test.ts`、`test/frame-translation-runtime.test.ts`、`test/paragraph-translation.test.ts`。核对动态新增、节点替换、译文模式切换、关闭还原及迟到响应。核对废弃实现引用已清除。

### P0.2 合并 Vitest 检查入口

文件涉及 `apps/extension/package.json`、`apps/extension/test/vitest.image-translation.config.ts` 和 `apps/extension/test/README.md`。

- [ ] 列出现有 `check` 执行的 Vitest、Node test 和 tsx 用例，记录扩展检查耗时。给独立脚本和历史手工测试标明运行方式。
- [ ] 在现有 Vitest 配置中通过 `test/**/*.test.{ts,tsx}` 发现用例。由统一命令执行，保留 jsdom 文件注解、变换配置和 Windows 并发上限。将 `.test.cjs` 的 Node 测试、独立 tsx 脚本及手工测试按原入口执行。继续提供已用于文档、CI 或日常定向回归的命令。
- [ ] 用 `vitest list --filesOnly` 核对原有 Vitest 文件全部保留，确认两个遗漏文件进入 `check`，并确认 `src/translation/cache/__tests__/cache.test.ts` 的手工入口和 Node CJS 文件不会被误收集。
- [ ] 运行 `pnpm --filter @mewcat/extension check` 和 `pnpm test:workspace`，与原命令在同环境比较耗时。验收重点是自动覆盖无缺失、文件清单归一，以及 PR 和发布门禁可继续复用同一条检查命令。

## 第二批候选：按基线评估局部性能优化

### P1.0 建立可复测的基线

- [ ] 在同一源码基线运行 `pnpm build:verify extension`。根据产物 Manifest 记录全站脚本、按需脚本及关联资源的原始字节数。
- [ ] 用 Chrome 同版本、同机器、固定测试页重复测量，每个场景先预热再采集至少 5 次。记录默认加载的扩展脚本 CPU 中位数，以及长文档首次翻译、持续变更和滚动场景的翻译相关 CPU 和单批耗时。使用 `apps/extension/example`、`test/fixtures/viewport-translation.*` 与模拟翻译响应。
- [ ] 记录页面候选规模、mutation 批次、整页提取次数、几何读取次数、请求数和首批译文出现时间。优先复用 `PerformanceMonitor` 和 Chrome trace；诊断计数只用于测量。

### P1.1 减少默认页面启动开销

文件涉及 `apps/extension/src/entrypoints/initialize.content.tsx`、`src/contents/initialize.tsx`、`src/utils/detectPageLanguage.ts` 和 `src/contents/TranslationControlCenter.tsx`，其中 `src/` 路径均相对于 `apps/extension`。

- [ ] 检查语言初始化入口的时机、配置写入和监听清理。只有现有基线能覆盖这些行为时，才评估移除无可见 UI 的 React 根和 Shadow DOM，沿用入口、事件和后台写入接口。
- [ ] 比较 `detectPageLanguage()` 两处调用在首次打开、切换标签、短文本、SPA 导航及人工选择情况下的语义。只有输入、生命周期和失效条件等价时才考虑复用结果。检查真实 MV3 加载、资源声明和 CSP。
- [ ] 重新测量默认注入字节数、CPU 和首次触发延迟。页面总结改为按需加载涉及首次触发时序，列入后续候选。

### P1.2 降低动态翻译重复计算

文件涉及 `apps/extension/src/translation/ImmersiveTranslator.ts`、`DomSelector.ts`、`DOMTraverser.ts`、`ViewportTranslationScheduler.ts` 和 `readingViewport.ts`。

- [ ] 根据 trace，优先评估复用条件明确的重复计算，例如对同一版本原文复用编码长度。候选排序只有在几何、候选身份和任务状态均等价时才复用。缓存等待之后及真正发请求之前仍按原路径确认位置、有效节点和会话状态。
- [ ] 将按变化子树局部提取列入后续候选。只有站点规则、祖先属性和跨节点分组的等价行为可复验时，才考虑调整当前整页扫描。
- [ ] 用视口、GitHub、段落、换行和 iframe 回归，并在真实 Chrome 用现有视口夹具验证快速滚动暂停、停止后补译、内部滚动容器、内容移动和节点删除。追加能复现误命中或迟到响应的测试。
- [ ] 对照长文档小范围更新、首次翻译和滚动基线。验证请求量、译文覆盖、顺序及取消行为一致，再根据翻译相关 CPU 中位数和首批译文耗时评估收益。

## 后续候选：测出收益再立项

| 候选               | 立项与验证                                                                                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 页面总结按需加载   | 只有测出启动开销后才评估。复用 `test/page-summary-entrypoint.test.tsx`，验证自动总结关闭时首次手动触发、同页并发复用请求、导航取消和加载失败后的重试。                                                                                                                        |
| 动态内容局部提取   | 用 Chrome trace 确认全页遍历是主要开销后再评估。用同一页面快照比较译文候选和原文结构，对影响范围不明确的变更沿用整页提取。                                                                                                                                                    |
| 去掉 CI 重复构建   | 根 `postinstall`、扩展 `predev/prebuild`、workspace 递归构建和 CI 步骤分别承担部分构建。记录每条入口的执行图，确认同一路径重复且可省下可观时间后，收敛到依赖图中现有入口。用冷安装、根目录及扩展目录直接调用验证，覆盖共享包未生成的情况。                                    |
| 设置页按标签加载   | `apps/extension/src/options/index.tsx` 静态导入所有标签页。先测默认页的加载和首次切换，再评估让 Analytics、TokenUsage 等非默认页延迟加载。检查 URL 直达、切换、加载失败边界和原有导航。                                                                                       |
| 收拢模型设置职责   | `apps/extension/src/options/TranslateServices.tsx` 混有模型编辑、发现、请求测试和计时状态。仅在相关功能需要修改时提取已确认共享的逻辑，优先保证模型切换、计时器清理和配置写入顺序。                                                                                           |
| 减少画像的冗余查询 | 用本地合成 SQLite 数据记录 `profile()` 的 SQL 次数与 p95，并确认两次 `summary()` 的结果消费范围。若成本明显，复用现有统计查询中的 totals 部分，同时保留专用 summary 的 p95、留存和取消语义。先用现有 schema 验证，覆盖 `analytics-query.test.ts` 和 `analytics-api.test.ts`。 |

## 审阅重点

- 默认安装与已有配置升级时，语言检测、手动选择和其他并发配置写入的行为一致。
- 首次手动总结、自动总结关闭、SPA 立即导航三种情况能正确加载、响应和取消。
- DOM 同文本节点重建、译文容器复用、祖先样式切换与 iframe 移除时，译文归属与清理正确。
- 快速滚动、内部容器变化、缓存等待和翻译关闭交错时，调度顺序、请求上限和迟到结果处理与现有行为一致。
- 检查覆盖可以从文件发现列表核对，生产包能够加载，性能指标可用固定夹具复测。

建议先审阅第一批。代码清理通过前后对照即可验收。运行路径改动额外提供实测收益，并以功能等价验证作为合入条件。

## Knip 清理保留记录

| 保留项 | 用途 |
| --- | --- |
| `apps/extension/src/features/translation/ListenEvent.ts` | 保留翻译事件监听模块，路径已随翻译功能目录迁移。 |
| `apps/extension/scripts/fixme.mjs` | 保留手动扫描待办标记的脚本。 |
| `apps/extension/scripts/pre-commit.mjs`、`husky`、`zx` | 根目录 Husky 在提交前调用脚本，脚本通过 `zx` 依次执行格式、扩展 ESLint、共享包构建、扩展类型和拼写检查。 |
| `@floating-ui/core` | 扩展保留精确的直接依赖版本 `1.7.3`。 |
| `eslint-config-prettier`、`eslint-plugin-prettier` | 扩展 ESLint 通过 `eslint-plugin-prettier/recommended` 启用两项依赖，报告 Prettier 格式错误并关闭冲突规则。 |
| `esbuild` | 保留扩展和服务端的直接构建依赖，以及共享客户端的浏览器打包依赖。服务端 Docker 构建会显式重建 esbuild。 |

已有检出的仓库可在根目录运行 `pnpm prepare` 启用钩子，再运行 `git hook run pre-commit` 验证。

后续已移除 `@types/styled-components`，扩展使用 `styled-components@6.1.8` 自带的类型。

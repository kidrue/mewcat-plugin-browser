# 晴空来信 UI 实施计划

用户已基于蓝白二次元提示词和四入口 HTML demo 要求转为 skill 并开始实现。

## 范围与选择

- 将风格封装为个人 skill `sky-letter-anime-ui`，包含视觉规范、四入口适配、素材提示词和可复用素材。
- 在当前工作目录的 `codex/sky-letter-ui` 分支实施，保留已有未提交改动，尤其悬浮按钮的 12px 吸边修正。
- 继续使用 React、styled-components、现有 CSS tokens 和 Jotai。重写框架会增加无关迁移风险；仅替换截图无法接入真实操作，因此采用现有组件渐进改造。
- MV3 可行性：图片经 public/assets 打包，以 chrome.runtime.getURL 解析；沿用现有 web_accessible_resources 与 Shadow DOM 的 :host 主题。无需增加远程字体、脚本、权限或 CDN。
- 数据流维持现有配置 atom、消息协议和翻译服务。风格命名不替换 mewCat 品牌，不引入 demo 假译文或伪造服务状态。

## 任务与文件边界

1. 主代理：个人 skill、`src/styles/theme.scss`、`src/components/SkyArtwork/index.tsx`、`src/public/assets/sky-letter/`；统一主题与共享插画。
2. Options：`src/options/index.tsx`、`src/components/OptionsSidebar/index.tsx`、`src/components/OptionsContentHeader/index.tsx`、`src/components/OptionsSection/index.tsx`、`src/styles/options.scss`。建立侧栏、邮局首屏、安静表单区，保留六个业务页。
3. 紧凑入口：`src/components/SettingsPanel/index.tsx`、`src/popup/index.tsx`、`src/sidepanel/index.tsx`、`src/styles/popup.scss`。小幅场景、角色与信纸组件，保留设置、翻译、剪贴板、错误、加载操作。
4. 悬浮入口：`src/contents/TranslationControlCenter.tsx`。蓝白状态样式与轻量反馈，保留拖拽、吸边、翻译、刷新缓存与共享设置面板。
5. 整体审阅，执行格式化、全量检查、生产构建，检查打包资源。通过后追加 AGENTS 修改记录。

## 共享接口

`@/components/SkyArtwork` 导出 `SkyBackdrop` 与 `SkyMascot`，均接受 `className?: string`，输出装饰 img，使用空 alt、aria-hidden、禁止拖拽、pointer-events:none。调用方使用 styled 包装确定位置和尺寸。背景为 `assets/sky-letter/post-office.webp`，角色为 `assets/sky-letter/mascot.webp`。保持现有 BrandLogo。

主题主色 #2878c8，hover #1d5f9e，页面 #f2f8fe，纸面 #ffffff，正文 #203b57，次正文 #4d6780；现有 token 名称保持兼容。

## 验收

- 四入口共用蓝白语言；大图集中在 Options，紧凑入口仍然易读；装饰不覆盖输入和弹层。
- keyboard focus 清晰，表单标签保留，窄屏可滚动；prefers-reduced-motion 可关闭非必要动画。
- `pnpm format` 后执行 `VITEST_MAX_WORKERS=2 pnpm check`，然后 WXT 生产构建，确认图像为扩展内部资源。
- 当前浏览器对前轮本地 demo 地址有明确安全拒绝，不绕过限制；若无法进行浏览器视觉检查，交付中明确说明验证边界。

## 执行记录

- 初始评审：任务 1 提供共享组件和 tokens，任务 2/3 消费；任务 4 消费 tokens 和任务 3 的 SettingsPanel，接口不变。各代理修改文件互不重叠，统一格式化由主代理在汇总后执行。
- 仅 UI 与文档，不新增翻译行为；使用现有行为测试验证真实能力，不为颜色和文案编写镜像测试。

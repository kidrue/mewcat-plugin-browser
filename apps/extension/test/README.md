# 扩展测试

以下命令在 `apps/extension` 执行。全量检查运行 `pnpm check`。示例页和几何测试可在不调用付费 API 的情况下验收主要交互。

## 自动化测试

`pnpm test:vitest` 运行 `test/` 下的全部 `*.test.ts` 和 `*.test.tsx` 文件。新增 Vitest 用例按这个约定命名即可进入 `pnpm check`。可以传入文件路径筛选用例，也可用原有分组命令单独复验。

```bash
pnpm test:vitest test/model-management.test.ts
pnpm exec vitest list --filesOnly --config test/vitest.image-translation.config.ts
```

`pnpm check` 同时通过 `check:hotlink-rules` 和 `test:chrome-web-store` 运行 Node 测试，通过 `test:google` 和 `test:selection:tsx` 运行独立交互脚本。源码目录中的缓存测试在浏览器环境下手工运行。

## 浏览器功能与阅读流程

运行 `pnpm example`，用已加载 mewCat 的 Chrome 打开 <http://127.0.0.1:4173>。页面提供沉浸式翻译、划词、多语言、动态内容、图片翻译和页面总结的验收素材与记录模板。加载新构建后先刷新已打开的测试页。详见[示例说明](../example/README.md)。

真实浏览器复验覆盖长文和多个标签页、SPA 导航、受限页面、连续翻译或清理、未配置模型、设置页窄屏和键盘操作。检查“设置 → 基础设置 → 阅读翻译 → 按阅读范围翻译”默认开启。使用生产调度器和模拟响应的几何测试覆盖三屏范围、快速滚动暂停、停下后补译、内层滚动容器尺寸变化和销毁清理。

```bash
pnpm test:vitest test/viewport-translation-scheduler.test.ts test/viewport-translation.test.ts
pnpm exec vite --config test/vite.viewport.config.ts
```

打开 <http://127.0.0.1:5178/viewport-translation.html>，点击“运行浏览器验收”。

## 配置持久化

修改当前翻译服务，随后打开 Popup 确认已同步。依次设置小圆点、Shift 和 Ctrl 并在多个标签页之间切换，确认旧页面不会覆盖触发方式。可同时从不同页面修改触发方式和图片翻译开关，检查两处设置均已保存。跨设备同字段的变更遵循 Chrome 同步机制。

```bash
pnpm test:config-migration
pnpm test:vitest test/config-persistence.test.ts test/extension-config-validation.test.ts
```

## 反馈排查

`pnpm test:feedback` 覆盖表单、后台消息来源和参数、身份初始化、取消隔离、超时及错误提示。手工测试可从 Popup 底部或“设置 → 关于”打开反馈，确认已有反馈页重新激活，发送失败后原输入仍保留，提交中无法重复发送。

本地运行 `pnpm dev` 时，反馈仍和免费翻译一样连接 [MEWCAT_SERVICE_ORIGIN](../src/constants/translationServices.ts) 中的生产地址。线上 `POST /v1/feedback` 返回 `404 / NOT_FOUND` 时，先核对后端部署是否包含反馈接口。无有效信封的请求会返回 `400 / INVALID_REQUEST`，可用于确认路由存在。SMTP 配置和收件排查见[服务部署手册](../../service/docs/deploy.md)，接口和错误码见[服务 API](../../service/docs/api.md)。

## 兼容测试脚本

`pnpm test:401` 模拟旧版 401 拦截器，可用于复查其行为。反馈、免费翻译和设备身份以当前共享 SDK 的测试为准。扩展发布包和 Sentry 上报的复验步骤见[发布手册](../docs/chrome-web-store-automation.md)。

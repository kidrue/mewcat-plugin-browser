# mewCat（译趣喵）Chrome 扩展

mewCat 支持网页双语阅读、段落翻译、划词翻译和侧边栏文本翻译。配置相应 AI 模型后，可翻译图片、总结页面或解释选中的概念。

默认使用 Google Translate，待翻译文本会发送到 Google 的网页端接口。可在设置中切换 Microsoft Translator、mewCat 免费翻译和自定义翻译服务。mewCat 免费翻译无需 API Key，首次使用时创建设备身份并将设备密钥存入 IndexedDB。待翻译文本加密发送到 mewCat 服务，再由服务端的翻译供应商处理。各功能的数据用途见[隐私政策](../../PRIVACY.md)。

## 本地开发与构建

使用 Node.js 22.12+ 和 pnpm 10.20.0。从仓库根目录运行。

```bash
pnpm install --frozen-lockfile
pnpm dev:extension
```

在 `chrome://extensions` 启用开发者模式，选择“加载已解压的扩展程序”，加载 `apps/extension/.output/chrome-mv3-dev`。扩展更新后刷新测试网页，让当前页面重新加载内容脚本。

| 根目录命令 | 用途 |
| --- | --- |
| `pnpm build:verify extension` | 验证扩展生产构建，不上传 Sentry Source Map。 |
| `pnpm build:extension` | 构建生产目录并生成带版本、时间的 ZIP。Chrome 可加载 `apps/extension/.output/chrome-mv3`。 |
| `pnpm --filter @mewcat/extension crx` | 用固定签名私钥和已生成的生产目录制作 CRX。 |
| `pnpm --filter @mewcat/extension check` | 运行扩展类型、代码、站点规则、拼写和测试检查。 |
| `pnpm --filter @mewcat/extension example` | 启动人工验收用的示例页面。 |

扩展版本以 [package.json](package.json) 的 `version` 为准。签名、Sentry 和商店审核流程见[发布手册](docs/chrome-web-store-automation.md)。

## 浏览器权限

| 权限 | 用途 |
| --- | --- |
| `<all_urls>`、`scripting` | 在用户阅读的网站中运行翻译脚本，访问图片和用户选择的翻译服务。 |
| `tabs`、`webNavigation` | 识别当前标签页、页面导航和子框架，协调页面翻译及图片抓取。 |
| `storage` | 保存设置、功能状态及本地数据。 |
| `sidePanel`、`contextMenus` | 提供侧边栏和右键菜单。 |
| `declarativeNetRequest`、`declarativeNetRequestWithHostAccess` | 在抓取有防盗链规则的图片时调整请求头。 |

实际权限由 [wxt.config.ts](wxt.config.ts) 定义。代码维护见[扩展架构](docs/architecture.md)和[测试说明](test/README.md)，仓库通用命令见[根 README](../../README.md)。

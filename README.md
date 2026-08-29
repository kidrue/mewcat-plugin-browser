# 译趣喵 (mewCat) 浏览器翻译插件

一个强大的浏览器扩展，提供实时网页翻译功能，支持多种翻译模式和自定义配置。

## 功能特点

### 核心功能

- **沉浸式翻译**：智能识别页面内容，批量翻译并在原位置显示翻译结果
- **划词翻译**：选中文本即可快速翻译
- **右键菜单翻译**：通过右键菜单快速翻译选中内容
- **悬浮按钮控制**：可拖拽的浮动按钮，一键开启/关闭翻译

### 翻译模式

- **HTML标准翻译**：基于HTML标准的网页翻译
- **沉浸式翻译**：智能识别页面布局，保持原有排版风格
- **默认 Google Translate**：首次安装无需 API Key 即可翻译，也可切换到已配置的 AI 模型
- **通用翻译器**：支持多种翻译 API 服务

> Google Translate 默认通道使用 Google 网页端非公开接口。使用该服务时，待翻译文本会发送到 Google；接口可能受到限流或变更影响。

### 高级特性

- **智能语言检测**：自动检测源语言（基于franc库）
- **自定义翻译规则**：支持为不同网站设置专属翻译规则
- **域名过滤**：可配置包含/排除特定域名
- **翻译样式自定义**：多种翻译显示样式可选
- **增量翻译**：支持动态内容的实时翻译
- **调试模式**：提供详细的翻译过程调试信息

## 技术栈

- **框架**: [WXT](https://wxt.dev/) - 浏览器扩展开发框架
- **前端框架**: React 18
- **状态管理**: Jotai
- **样式**: Styled Components
- **语言**: TypeScript
- **构建工具**: WXT + Vite
- **包管理**: pnpm

## 项目结构

```
├── src/
│   ├── entrypoints/          # WXT 后台、内容脚本和扩展页面入口
│   ├── background/          # 后台脚本
│   │   └── messages/        # 消息处理
│   ├── components/          # React组件
│   │   ├── ApiKeyInput/     # API密钥输入
│   │   ├── ModelDiscoveryField/ # 自动模型发现与能力选择
│   │   ├── CustomSelect/    # 自定义选择器
│   │   ├── CustomToggle/    # 开关组件
│   │   ├── Icon/            # 图标组件
│   │   ├── LoadingDots/     # 加载动画
│   │   ├── Tooltip/         # 提示框
│   │   ├── TranslateTextPanel/ # 翻译面板
│   │   └── UrlManager/      # URL管理器
│   ├── contents/            # 内容脚本
│   │   ├── TranslationControlCenter.tsx  # 翻译控制中心
│   │   ├── initialize.tsx   # 初始化脚本
│   │   └── selectionTranslate.tsx # 划词翻译
│   ├── translation/         # 翻译核心模块
│   │   ├── ImmersiveTranslator.ts    # 沉浸式翻译器
│   │   ├── HtmlStandardTranslator.ts # HTML标准翻译器
│   │   ├── translationService.ts     # 函数式翻译路由
│   │   └── modelTranslation.ts       # 模型提示词与网关客户端
│   ├── model-management/    # 供应商注册、模型发现与配置迁移
│   ├── state/               # 状态管理
│   │   ├── config.ts        # 配置状态
│   │   └── user.ts          # 用户状态
│   ├── utils/               # 工具函数
│   │   ├── domUtils.ts      # DOM操作工具
│   │   ├── debugUtils.ts    # 调试工具
│   │   ├── securityManager.ts # 安全管理
│   │   └── translationStyles.ts # 翻译样式
│   ├── popup/               # 弹出窗口
│   ├── options/             # 选项页面
│   └── sidepanel/           # 侧边栏面板
│   ├── assets/              # WXT 构建期资源（扩展图标）
│   └── public/              # 原样复制到扩展产物的静态资源
├── scripts/                 # 构建脚本
├── wxt.config.ts            # WXT 与 Manifest 配置
└── package.json
```

## 安装与开发

### 环境要求

- Node.js >= 22.12
- pnpm >= 10

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

WXT 的开发扩展目录为 `.output/chrome-mv3-dev`。首次从旧版 Plasmo
构建迁移，或浏览器中的 UI 没有随源码更新时：

1. 打开 `chrome://extensions` 并启用“开发者模式”。
2. 移除之前从 `build/chrome-mv3-dev` 或 `build/chrome-mv3-prod` 加载的
   mewCat 扩展。
3. 点击“加载已解压的扩展程序”，选择 `.output/chrome-mv3-dev`。
4. 重新加载正在测试的网页；如内容脚本仍未更新，再点击扩展卡片上的刷新按钮。

`pnpm dev` 检测到旧 `build/` 产物时会打印上述路径提示，但不会自动删除旧目录或修改浏览器配置。

### 构建生产版本

```bash
pnpm build
```

生产构建完成后，如需在 Chrome 中验证，请加载 `.output/chrome-mv3`，不要加载旧的 `build/` 目录。

### 打包扩展

```bash
pnpm package
```

## 脚本命令

| 命令               | 说明                                   |
| ------------------ | -------------------------------------- |
| `pnpm dev`         | 启动开发服务器，支持热重载             |
| `pnpm build`       | 构建生产版本                           |
| `pnpm package`     | 打包扩展为zip文件                      |
| `pnpm package:dev` | 打包开发模式扩展                       |
| `pnpm lint`        | 运行ESLint检查                         |
| `pnpm typecheck`   | TypeScript类型检查                     |
| `pnpm format`      | 格式化代码                             |
| `pnpm check`       | 运行所有检查（类型、lint、格式、拼写） |
| `pnpm spell`       | 拼写检查                               |
| `pnpm commit`      | 使用commitizen提交代码                 |
| `pnpm clean`       | 清理构建产物和依赖                     |

## 浏览器权限

扩展需要以下权限：

- `tabs` - 访问标签页信息
- `scripting` - 注入内容脚本
- `windows` - 管理浏览器窗口
- `contextMenus` - 创建右键菜单
- `https://*/*` - 访问所有HTTPS网站（用于翻译功能）

## 主要功能模块

### 沉浸式翻译器 (ImmersiveTranslator)

- 智能识别页面内容结构
- 批量翻译优化
- 保持原有页面布局
- 支持增量更新

### 统一模型网关

- 默认使用 Google Translate，并支持切换已配置的 AI 模型
- 保留现有用户的可用模型选择；无可用模型时回退到 Google Translate
- 使用 xsAI 统一文本、结构化图片输出和 OpenAI-compatible 调用
- API Key 填写后自动获取模型列表，并持久化文本/图片能力元数据
- DeepL 与 DeepLX 继续使用固定翻译接口，不伪装为大语言模型

### 安全管理器 (SecurityManager)

- XSS防护
- 内容过滤
- API密钥加密存储

## 调试功能

项目内置了完善的调试系统，包括：

- 元素选择器调试
- 翻译规则匹配调试
- 性能监控
- 错误日志记录

## 配置文件

- `eslint.config.mjs` - ESLint配置
- `prettier.config.mjs` - Prettier代码格式化配置
- `tsconfig.json` - TypeScript配置
- `cspell.json` - 拼写检查配置
- `knip.json` - 依赖检查配置

## 贡献指南

1. Fork本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`pnpm commit`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 许可证

本项目为私有项目，版权所有。

## 版本

v0.0.1

## 联系方式

如有问题或建议，请提交Issue。

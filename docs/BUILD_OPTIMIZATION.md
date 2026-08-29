# WXT 构建与打包

项目已使用 WXT 和 Vite 构建 Chrome Manifest V3 扩展。生产构建由 WXT 负责代码分割、Tree Shaking、JavaScript/CSS 压缩和清单生成。

## 常用命令

```bash
# 启动开发模式
pnpm dev

# 完整生产构建，并生成带日期的 ZIP
pnpm build

# 仅生成生产目录
pnpm exec wxt build

# 生成开发模式 ZIP
pnpm package:dev

# 根据已生成的生产目录制作 CRX
pnpm crx
```

`pnpm build` 会先执行 WXT 生产构建，再生成商店上传包：

- 解压目录：`.output/chrome-mv3`
- 发布包：`.output/chrome-mv3-prod-YYYYMMDD.zip`
- CRX：`release/mewcat-v<version>.crx`

## 可选代码混淆

如确实需要在本地检查混淆效果，可在生产构建后执行：

```bash
pnpm exec wxt build
pnpm obfuscate
```

混淆脚本处理 `.output/chrome-mv3` 中的 JavaScript。它不属于默认发布流程，因为控制流和字符串混淆可能影响浏览器扩展的运行时兼容性。再次运行 `wxt build` 或 `wxt zip` 会重新生成输出目录。

## 配置位置

- `wxt.config.ts`：WXT、Manifest、权限、资源和模块配置
- `src/entrypoints/`：后台、内容脚本、弹窗、选项页和侧边栏入口
- `scripts/build-with-timing.cjs`：完整生产构建
- `scripts/package-with-date.cjs`：生成带日期的 ZIP
- `scripts/obfuscate.cjs`：可选混淆

## 故障排除

1. 使用 Node.js 22.12 或更高版本，并启用 pnpm 10。
2. 运行 `pnpm clean` 清理 `.wxt`、`.output` 和旧缓存。
3. 运行 `pnpm install`，安装结束后会自动执行 `wxt prepare` 生成类型文件。
4. 运行 `pnpm check` 检查类型、Lint、格式、拼写和热链规则。
5. 单独运行 `pnpm exec wxt build`，可以获得最直接的构建错误信息。

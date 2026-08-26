# 构建脚本说明

项目使用 WXT 进行 Chrome MV3 构建，默认输出目录为 `.output/chrome-mv3`。

## 常用命令

```bash
pnpm dev          # WXT 开发模式
pnpm build        # 生产构建并生成带日期的 ZIP
pnpm package      # 仅生成带日期的生产 ZIP
pnpm package:dev  # 生成开发模式 ZIP
pnpm crx          # 使用固定私钥生成 CRX
```

`pnpm build` 依次执行 WXT 生产构建、清理旧 ZIP 和 WXT ZIP 打包，并输出各阶段耗时。生产 ZIP 位于 `.output/chrome-mv3-prod-YYYYMMDD.zip`。

## CRX 签名

`scripts/build-crx.cjs` 从 `.output/chrome-mv3` 生成签名 CRX。私钥来自环境变量 `CRX_PRIVATE_KEY` 或项目根目录的 `key.pem`。私钥必须固定，否则扩展 ID 会发生变化。

```bash
node scripts/gen-crx-key.cjs
pnpm crx
```

## 防盗链规则

规则源位于 `src/public/assets/request_modifier_rule.json`，同步后生成 `src/background/config/hotlink-sites.generated.ts`：

```bash
pnpm sync:hotlink-rules
pnpm check:hotlink-rules
```

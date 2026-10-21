import { defaultAllowedOrigins } from "../src/config.js"

// 只输出经过校验的仓库配置，供构建后的部署步骤注入环境变量。
console.log(`ALLOWED_ORIGINS=${defaultAllowedOrigins}`)

import { fileURLToPath } from "node:url"
import { $, usePowerShell } from "zx"

if (process.platform === "win32") usePowerShell()

const root = fileURLToPath(new URL("../../../", import.meta.url))
const extension = "@mewcat/extension"
const run = $({ cwd: root, stdio: "inherit" })

await run`pnpm format:check`
await run`pnpm --filter ${extension} lint`
await run`pnpm build:packages`
await run`pnpm --filter ${extension} typecheck`
await run`pnpm --filter ${extension} spell`

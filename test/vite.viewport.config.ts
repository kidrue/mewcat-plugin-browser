import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
    root: fileURLToPath(new URL("./fixtures", import.meta.url)),
    server: {
        host: "127.0.0.1",
        port: 5178,
        strictPort: true,
        fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] }
    }
})

import { readFile } from "node:fs/promises"
import { createServer } from "node:http"

const files = new Map([
    ["/", ["index.html", "text/html; charset=utf-8"]],
    ["/index.html", ["index.html", "text/html; charset=utf-8"]],
    ["/style.css", ["style.css", "text/css; charset=utf-8"]],
    ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
    ["/assets/reading-card.png", ["assets/reading-card.png", "image/png"]]
])
const port = Number(process.env.PORT ?? 4173)
if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be an integer between 0 and 65535")
}

const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" }).end()
        return
    }
    let pathname
    try {
        pathname = new URL(request.url, "http://127.0.0.1").pathname
    } catch {
        response.writeHead(400).end()
        return
    }
    const file = files.get(pathname)
    if (!file) {
        response.writeHead(404).end("Not Found")
        return
    }
    try {
        const body = await readFile(new URL(file[0], import.meta.url))
        response.writeHead(200, {
            "Content-Type": file[1],
            "Content-Length": body.length,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
        })
        response.end(request.method === "HEAD" ? undefined : body)
    } catch (error) {
        console.error(error.message)
        response.writeHead(500).end("Unable to load example asset")
    }
})

server.on("error", error => {
    console.error(`example 服务启动失败：${error.message}`)
    process.exitCode = 1
})
server.listen(port, "127.0.0.1", () => {
    console.log(`mewCat 验收页面：http://127.0.0.1:${server.address().port}`)
    console.log("使用已加载 mewCat 的 Chrome 打开；按 Ctrl+C 停止。")
})

import { createServer } from 'http'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { exec } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PORT = 3333
const HOST = 'localhost'

const server = createServer((req, res) => {
    // 处理根路径和 /test-rpc.html
    if (req.url === '/' || req.url === '/test-rpc.html') {
        try {
            const html = readFileSync(join(__dirname, 'test-rpc.html'), 'utf-8')
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            })
            res.end(html)
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end('Error loading test page')
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
    }
})

server.listen(PORT, HOST, () => {
    const url = `http://${HOST}:${PORT}`
    console.log('='.repeat(60))
    console.log('🚀 gRPC/Connect RPC 测试服务器已启动')
    console.log('='.repeat(60))
    console.log(`\n📡 服务地址: ${url}`)
    console.log(`📄 测试页面: ${url}/test-rpc.html`)
    console.log('\n💡 提示: 按 Ctrl+C 停止服务器\n')
    console.log('='.repeat(60))

    // 自动打开浏览器
    const openCommand = process.platform === 'darwin' ? 'open' :
                       process.platform === 'win32' ? 'start' : 'xdg-open'

    exec(`${openCommand} ${url}`, (error) => {
        if (error) {
            console.log(`\n⚠️  无法自动打开浏览器，请手动访问: ${url}`)
        } else {
            console.log('\n✅ 浏览器已自动打开\n')
        }
    })
})

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n\n👋 正在关闭服务器...')
    server.close(() => {
        console.log('✅ 服务器已关闭')
        process.exit(0)
    })
})
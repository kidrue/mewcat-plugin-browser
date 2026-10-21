import { mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"

export async function ensureDatabaseDirectory(url: string): Promise<void> {
    if (!url.startsWith("file:") || url.length <= 5)
        throw new Error("DATABASE_URL 必须为 SQLite file: URL")
    await mkdir(dirname(resolve(url.slice(5))), { recursive: true })
}

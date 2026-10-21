import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { createStore, type Store } from "../src/store.js"

export async function applyMigrations(store: Store, selected?: string[]) {
    const migrationsRoot = resolve("prisma/migrations")
    const migrations =
        selected ??
        (await readdir(migrationsRoot, { withFileTypes: true }))
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name)
            .sort()
    for (const migration of migrations) {
        const sql = await readFile(
            resolve(migrationsRoot, migration, "migration.sql"),
            "utf8"
        )
        for (const statement of sql.split(";").filter(part => part.trim())) {
            await store.db.$executeRawUnsafe(statement)
        }
    }
}

export async function testStore() {
    const directory = await mkdtemp(join(tmpdir(), "mewcat-api-"))
    const store = createStore(
        `file:${join(directory, "test.db").replaceAll("\\", "/")}`
    )
    await applyMigrations(store)
    return {
        store,
        async cleanup() {
            await store.db.$disconnect()
            await rm(directory, { recursive: true, force: true })
        }
    }
}

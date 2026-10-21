import { ensureDatabaseDirectory } from "../src/database-path.js"

await ensureDatabaseDirectory(
    process.env.DATABASE_URL ?? "file:./data/mewcat.db"
)

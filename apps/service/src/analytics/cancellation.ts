import { setImmediate } from "node:timers/promises"

/** 让断开连接/超时事件在下一条 SQLite 查询前得到处理。当前语句完成前仍保留并发槽。 */
export async function queryCheckpoint(signal?: AbortSignal): Promise<void> {
    if (!signal) return
    await setImmediate(undefined, { signal })
    signal.throwIfAborted()
}

import type { TranslationNode } from "./DOMTraverser"
import {
    compareReadingDOM,
    getReadingPosition,
    getReadingRoot,
    readingHeight,
    type ReadingRoot
} from "./readingViewport"

interface TranslationResult {
    node: TranslationNode
    text: string
}
interface SchedulerOptions {
    viewportOnly: boolean
    getLimits: () => {
        maxRequestsPerSecond: number
        maxTextLengthPerRequest: number
        maxConcurrent?: number
    }
    readCache: (node: TranslationNode) => Promise<string | null>
    writeCache: (node: TranslationNode, text: string) => Promise<void>
    translate: (nodes: TranslationNode[]) => Promise<string[]>
    render: (results: TranslationResult[]) => void
    onError: (error: unknown, nodes: TranslationNode[]) => void
}
interface Task {
    node: TranslationNode
    state: "pending" | "preparing" | "inflight" | "done" | "failed"
    prepared: boolean
    cached: string | null
}
interface ScrollSample {
    offset: number
    time: number
    direction: number
}

/** One queue for initial, incremental and explicitly retried page content. */
export class ViewportTranslationScheduler {
    private tasks = new Map<string, Task>()
    private tasksByElement = new Map<Element, Set<Task>>()
    private candidates = new Set<Element>()
    private observers = new Map<ReadingRoot, IntersectionObserver>()
    private resizeObserver: ResizeObserver | undefined
    private rootHeights = new Map<HTMLElement, number>()
    private samples = new Map<ReadingRoot, ScrollSample>()
    private timer: ReturnType<typeof setTimeout> | undefined
    private settleTimer: ReturnType<typeof setTimeout> | undefined
    private resizeTimer: ReturnType<typeof setTimeout> | undefined
    private active = 0
    private sentAt: number[] = []
    private fastScrolling = false
    private destroyed = false
    private viewportOnly: boolean

    constructor(private readonly options: SchedulerOptions) {
        this.viewportOnly = options.viewportOnly
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(entries => {
                if (this.destroyed) return
                if (
                    entries.some(
                        entry =>
                            this.rootHeights.get(
                                entry.target as HTMLElement
                            ) !== (entry.target as HTMLElement).clientHeight
                    )
                ) {
                    // Rebuild outside delivery to avoid a ResizeObserver loop.
                    if (this.resizeTimer === undefined)
                        this.resizeTimer = setTimeout(() => {
                            this.resizeTimer = undefined
                            this.onResize()
                        }, 0)
                }
            })
        }
        this.trackRoot(null)
        document.addEventListener("scroll", this.onScroll, {
            capture: true,
            passive: true
        })
        window.addEventListener("scroll", this.onWindowScroll, {
            passive: true
        })
        window.addEventListener("resize", this.onResize)
        document.addEventListener("visibilitychange", this.onVisibilityChange)
    }

    add(nodes: TranslationNode[], retry = false): void {
        if (this.destroyed) return
        this.remove(
            Array.from(this.tasks.values())
                .filter(task => !task.node.container.isConnected)
                .map(task => task.node.id)
        )
        for (const node of nodes) {
            if (!node.originText?.trim() || !node.container.isConnected)
                continue
            const previous = this.tasks.get(node.id)
            if (
                previous &&
                previous.node.container === node.container &&
                previous.node.originText === node.originText
            ) {
                previous.node = { ...node }
                if (!retry || previous.state !== "failed") continue
            }
            if (previous) this.remove([node.id])
            // Snapshot source identity, even if a virtualized page later reuses the element.
            const task: Task = {
                node: { ...node },
                state: "pending",
                prepared: retry,
                cached: null
            }
            this.tasks.set(node.id, task)
            const elementTasks =
                this.tasksByElement.get(node.container) ?? new Set<Task>()
            elementTasks.add(task)
            this.tasksByElement.set(node.container, elementTasks)
            this.observe(node)
        }
        this.schedule()
    }

    remove(ids: string[]): void {
        for (const id of ids) {
            const task = this.tasks.get(id)
            if (!task) continue
            this.tasks.delete(id)
            const elementTasks = this.tasksByElement.get(task.node.container)
            elementTasks?.delete(task)
            if (!elementTasks?.size) {
                this.tasksByElement.delete(task.node.container)
                this.candidates.delete(task.node.container)
                this.observers.forEach(observer =>
                    observer.unobserve(task.node.container)
                )
            }
        }
    }

    setViewportOnly(enabled: boolean): void {
        this.viewportOnly = enabled
        this.schedule()
    }

    private trackRoot(root: ReadingRoot): void {
        if (!this.samples.has(root))
            this.samples.set(root, {
                offset: root ? root.scrollTop : window.scrollY,
                time: Date.now(),
                direction: 0
            })
    }

    private observe(node: TranslationNode): void {
        const root = getReadingRoot(node.container)
        this.trackRoot(root)
        if (root) {
            this.rootHeights.set(root, root.clientHeight)
            this.resizeObserver?.observe(root)
        }
        if (getReadingPosition(node)) this.candidates.add(node.container)
        if (typeof IntersectionObserver === "undefined") return
        let observer = this.observers.get(root)
        if (!observer) {
            observer = new IntersectionObserver(
                entries => {
                    for (const entry of entries) {
                        if (entry.isIntersecting)
                            this.candidates.add(entry.target)
                        else this.candidates.delete(entry.target)
                    }
                    this.schedule()
                },
                {
                    root,
                    rootMargin: `${readingHeight(root)}px 0px`,
                    threshold: 0
                }
            )
            this.observers.set(root, observer)
        }
        observer.observe(node.container)
    }

    private onWindowScroll = (event: Event): void => {
        if (event.target === window) this.recordScroll(null)
    }

    private onScroll = (event: Event): void => {
        const root =
            event.target instanceof HTMLElement &&
            event.target !== document.documentElement &&
            event.target !== document.body
                ? event.target
                : null
        this.recordScroll(root)
    }

    private recordScroll(root: ReadingRoot): void {
        this.trackRoot(root)
        const sample = this.samples.get(root)!
        const offset = root ? root.scrollTop : window.scrollY
        const now = Date.now()
        const delta = offset - sample.offset
        if (delta) {
            sample.direction = Math.sign(delta)
            // Cap the sample window so the first jump after a long idle is caught.
            const elapsed = Math.max(16, Math.min(100, now - sample.time))
            if (Math.abs(delta) / elapsed >= (readingHeight(root) * 2) / 1000)
                this.fastScrolling = true
        }
        sample.offset = offset
        sample.time = now
        clearTimeout(this.settleTimer)
        this.settleTimer = setTimeout(() => {
            this.fastScrolling = false
            this.schedule()
        }, 200)
        this.schedule()
    }

    private onVisibilityChange = (): void => {
        this.schedule()
    }
    private onResize = (): void => {
        if (this.destroyed) return
        clearTimeout(this.resizeTimer)
        this.resizeTimer = undefined
        this.observers.forEach(observer => observer.disconnect())
        this.observers.clear()
        this.resizeObserver?.disconnect()
        this.rootHeights.clear()
        this.candidates.clear()
        for (const task of this.tasks.values()) {
            if (task.state === "pending" || task.state === "preparing")
                this.observe(task.node)
        }
        this.schedule()
    }

    private schedule(delay = 0): void {
        if (this.destroyed) return
        // A scroll/completion must be able to interrupt a request-rate timer.
        clearTimeout(this.timer)
        this.timer = setTimeout(() => {
            this.timer = undefined
            this.pump()
        }, delay)
    }

    private current(task: Task): boolean {
        return (
            !this.destroyed &&
            this.tasks.get(task.node.id) === task &&
            task.node.container.isConnected
        )
    }

    private allowed(): boolean {
        return (
            !this.destroyed &&
            (!this.viewportOnly ||
                (!this.fastScrolling && document.visibilityState !== "hidden"))
        )
    }

    private sortedPending(): Task[] {
        const pending: Task[] = []
        const candidates =
            this.viewportOnly && typeof IntersectionObserver !== "undefined"
                ? Array.from(this.candidates).flatMap(element =>
                      Array.from(this.tasksByElement.get(element) ?? [])
                  )
                : this.tasks.values()
        for (const task of candidates) {
            if (!task.node.container.isConnected) {
                this.remove([task.node.id])
            } else if (task.state === "pending") pending.push(task)
        }
        if (!this.viewportOnly)
            return pending.sort((a, b) => compareReadingDOM(a.node, b.node))
        return pending
            .flatMap(task => {
                if (
                    typeof IntersectionObserver !== "undefined" &&
                    !this.candidates.has(task.node.container)
                )
                    return []
                const position = getReadingPosition(task.node)
                return position ? [{ task, position }] : []
            })
            .sort((a, b) => {
                if (a.position.visible !== b.position.visible)
                    return a.position.visible ? -1 : 1
                const rank = (position: typeof a.position) => {
                    const direction =
                        this.samples.get(position.root)?.direction ||
                        this.samples.get(null)?.direction ||
                        0
                    return !direction ||
                        !position.side ||
                        position.side === direction
                        ? 0
                        : 1
                }
                return (
                    rank(a.position) - rank(b.position) ||
                    a.position.distance - b.position.distance ||
                    compareReadingDOM(a.task.node, b.task.node)
                )
            })
            .map(item => item.task)
    }

    private pump(): void {
        if (!this.allowed()) return
        const limits = this.options.getLimits()
        const maxRequests = Math.max(1, Math.floor(limits.maxRequestsPerSecond))
        while (
            this.active < (limits.maxConcurrent ?? maxRequests) &&
            this.allowed()
        ) {
            const pending = this.sortedPending()
            if (!pending.length) return
            const batch: Task[] = []
            let bytes = 0
            for (const task of pending) {
                const size =
                    new TextEncoder().encode(task.node.originText).length +
                    (batch.length ? 6 : 0)
                if (
                    batch.length &&
                    bytes + size > limits.maxTextLengthPerRequest
                )
                    break
                batch.push(task)
                bytes += size
            }
            if (batch.some(task => !task.prepared)) {
                batch.forEach(task => {
                    task.state = "preparing"
                })
                this.active++
                void this.prepare(batch)
                continue
            }
            const cached = batch.filter(task => task.cached)
            if (cached.length) {
                cached.forEach(task => {
                    task.state = "done"
                })
                this.options.render(
                    cached.map(task => ({
                        node: task.node,
                        text: task.cached!
                    }))
                )
                continue
            }
            const now = Date.now()
            this.sentAt = this.sentAt.filter(time => now - time < 1000)
            if (this.sentAt.length >= maxRequests) {
                this.schedule(1000 - (now - this.sentAt[0]))
                return
            }
            // No asynchronous work between this geometry/state check and translate.
            batch.forEach(task => {
                task.state = "inflight"
            })
            this.sentAt.push(now)
            this.active++
            void this.send(batch)
        }
    }

    private async prepare(batch: Task[]): Promise<void> {
        try {
            await Promise.all(
                batch.map(async task => {
                    if (!task.prepared) {
                        try {
                            task.cached = await this.options.readCache(
                                task.node
                            )
                        } catch {
                            task.cached = null
                        }
                        task.prepared = true
                    }
                    if (this.current(task)) task.state = "pending"
                })
            )
        } finally {
            this.active--
            this.schedule()
        }
    }

    private async send(batch: Task[]): Promise<void> {
        try {
            const texts = await this.options.translate(
                batch.map(task => task.node)
            )
            const results: Array<TranslationResult & { task: Task }> = []
            for (let index = 0; index < batch.length; index++) {
                const task = batch[index]
                if (!this.current(task)) continue
                const text = texts[index]
                if (typeof text !== "string" || !text.trim()) {
                    task.state = "failed"
                    this.options.onError(new Error("翻译结果为空，请重试"), [
                        task.node
                    ])
                    continue
                }
                task.state = "done"
                try {
                    await this.options.writeCache(task.node, text)
                } catch (error) {
                    console.warn("缓存翻译结果失败:", error)
                }
                if (this.current(task))
                    results.push({ node: task.node, text, task })
            }
            const currentResults = results
                .filter(result => this.current(result.task))
                .map(result => ({ node: result.task.node, text: result.text }))
            if (currentResults.length) this.options.render(currentResults)
        } catch (error) {
            const current = batch.filter(task => this.current(task))
            current.forEach(task => {
                task.state = "failed"
            })
            if (current.length)
                this.options.onError(
                    error,
                    current.map(task => task.node)
                )
        } finally {
            this.active--
            this.schedule()
        }
    }

    destroy(): void {
        this.destroyed = true
        clearTimeout(this.timer)
        clearTimeout(this.settleTimer)
        clearTimeout(this.resizeTimer)
        document.removeEventListener("scroll", this.onScroll, true)
        window.removeEventListener("scroll", this.onWindowScroll)
        window.removeEventListener("resize", this.onResize)
        document.removeEventListener(
            "visibilitychange",
            this.onVisibilityChange
        )
        this.observers.forEach(observer => observer.disconnect())
        this.observers.clear()
        this.resizeObserver?.disconnect()
        this.rootHeights.clear()
        this.samples.clear()
        this.tasks.clear()
        this.tasksByElement.clear()
        this.candidates.clear()
    }
}

/**
 * 性能监控阶段接口
 */
interface PerformanceStage {
    name: string
    startTime: number
    endTime?: number
    duration?: number
    children: PerformanceStage[]
    metadata?: Record<string, unknown>
}

/**
 * 性能监控配置
 */
interface PerformanceMonitorConfig {
    enabled: boolean
    logLevel: "none" | "summary" | "detailed"
    threshold?: number // 只显示超过阈值的阶段（ms）
    autoLog?: boolean // 是否自动打印日志
}

/**
 * 性能监控管理器
 * 用于统一管理和追踪各个执行阶段的性能
 *
 * 特性：
 * - 阶段化追踪：记录每个执行阶段的耗时
 * - 嵌套支持：支持子阶段的性能追踪
 * - 统计分析：自动计算百分比、识别瓶颈
 * - 可视化输出：树形结构展示性能数据
 * - 可配置：支持开关、日志级别控制
 */
export class PerformanceMonitor {
    private config: PerformanceMonitorConfig
    private rootStage: PerformanceStage | null = null
    private currentStage: PerformanceStage | null = null
    private stageStack: PerformanceStage[] = []

    constructor(config: Partial<PerformanceMonitorConfig> = {}) {
        this.config = {
            enabled: true,
            logLevel: "detailed",
            threshold: 0,
            autoLog: true,
            ...config
        }
    }

    /**
     * 开始监控一个新的根阶段
     */
    public start(name: string, metadata?: Record<string, unknown>): void {
        if (!this.config.enabled) {
            return
        }

        this.rootStage = {
            name,
            startTime: performance.now(),
            children: [],
            metadata
        }
        this.currentStage = this.rootStage
        this.stageStack = [this.rootStage]
    }

    /**
     * 开始一个子阶段
     */
    public startStage(name: string, metadata?: Record<string, unknown>): void {
        if (!this.config.enabled || !this.currentStage) {
            return
        }

        const stage: PerformanceStage = {
            name,
            startTime: performance.now(),
            children: [],
            metadata
        }

        this.currentStage.children.push(stage)
        this.stageStack.push(stage)
        this.currentStage = stage
    }

    /**
     * 结束当前阶段
     */
    public endStage(metadata?: Record<string, unknown>): void {
        if (!this.config.enabled || !this.currentStage) {
            return
        }

        this.currentStage.endTime = performance.now()
        this.currentStage.duration =
            this.currentStage.endTime - this.currentStage.startTime

        // 合并元数据
        if (metadata) {
            this.currentStage.metadata = {
                ...this.currentStage.metadata,
                ...metadata
            }
        }

        // 弹出栈，回到父阶段
        this.stageStack.pop()
        this.currentStage = this.stageStack[this.stageStack.length - 1] || null
    }

    /**
     * 结束整个监控并返回结果
     */
    public end(metadata?: Record<string, unknown>): PerformanceStage | null {
        if (!this.config.enabled || !this.rootStage) {
            return null
        }

        // 结束根阶段
        this.rootStage.endTime = performance.now()
        this.rootStage.duration =
            this.rootStage.endTime - this.rootStage.startTime

        if (metadata) {
            this.rootStage.metadata = {
                ...this.rootStage.metadata,
                ...metadata
            }
        }

        // 自动打印日志
        if (this.config.autoLog) {
            this.printReport()
        }

        const result = this.rootStage
        this.reset()
        return result
    }

    /**
     * 重置监控器
     */
    public reset(): void {
        this.rootStage = null
        this.currentStage = null
        this.stageStack = []
    }

    /**
     * 打印性能报告
     */
    public printReport(): void {
        if (!this.rootStage || this.config.logLevel === "none") {
            return
        }

        const report = this.generateReport()
        console.log(report)
    }

    /**
     * 生成性能报告
     */
    private generateReport(): string {
        if (!this.rootStage) {
            return ""
        }

        const lines: string[] = []
        const totalDuration = this.rootStage.duration || 0

        // 标题
        lines.push(`\n${"=".repeat(80)}`)
        lines.push(`📊 性能监控报告: ${this.rootStage.name}`)
        lines.push(`${"=".repeat(80)}`)
        lines.push(`总耗时: ${totalDuration.toFixed(2)}ms`)

        // 识别瓶颈
        const bottlenecks = this.findBottlenecks(this.rootStage, totalDuration)
        if (bottlenecks.length > 0) {
            lines.push(`\n🔴 性能瓶颈 (耗时 > 10% 或 > 100ms):`)
            bottlenecks.forEach(({ stage, percentage }) => {
                lines.push(
                    `  ⚠️  ${stage.name}: ${stage.duration?.toFixed(2)}ms (${percentage.toFixed(1)}%)`
                )
            })
        }

        // 详细阶段树
        if (this.config.logLevel === "detailed") {
            lines.push(`\n📈 详细阶段分析:`)
            this.buildStageTree(this.rootStage, lines, "", totalDuration)
        }

        // 元数据
        if (
            this.rootStage.metadata &&
            Object.keys(this.rootStage.metadata).length > 0
        ) {
            lines.push(`\n📋 统计信息:`)
            Object.entries(this.rootStage.metadata).forEach(([key, value]) => {
                lines.push(`  ${key}: ${value}`)
            })
        }

        lines.push(`${"=".repeat(80)}\n`)

        return lines.join("\n")
    }

    /**
     * 构建阶段树
     */
    private buildStageTree(
        stage: PerformanceStage,
        lines: string[],
        prefix: string,
        totalDuration: number,
        isLast: boolean = true
    ): void {
        const duration = stage.duration || 0
        const percentage =
            totalDuration > 0 ? (duration / totalDuration) * 100 : 0

        // 跳过低于阈值的阶段
        if (duration < this.config.threshold!) {
            return
        }

        // 构建树形符号
        const connector = isLast ? "└─" : "├─"
        const childPrefix = isLast ? "   " : "│  "

        // 性能标记
        let marker = ""
        if (percentage > 30) {
            marker = "🔴"
        }
        if (percentage > 10 && percentage <= 30) {
            marker = "🟡"
        }
        if (percentage > 5 && percentage <= 10) {
            marker = "🟢"
        }

        // 构建行
        let line = `${prefix}${connector} ${marker} ${stage.name}: ${duration.toFixed(2)}ms (${percentage.toFixed(1)}%)`

        // 添加元数据
        if (stage.metadata && Object.keys(stage.metadata).length > 0) {
            const metaStr = Object.entries(stage.metadata)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")
            line += ` [${metaStr}]`
        }

        lines.push(line)

        // 递归处理子阶段
        if (stage.children.length > 0) {
            stage.children.forEach((child, index) => {
                const isChildLast = index === stage.children.length - 1
                this.buildStageTree(
                    child,
                    lines,
                    prefix + childPrefix,
                    totalDuration,
                    isChildLast
                )
            })
        }
    }

    /**
     * 查找性能瓶颈
     */
    private findBottlenecks(
        stage: PerformanceStage,
        totalDuration: number
    ): Array<{ stage: PerformanceStage; percentage: number }> {
        const bottlenecks: Array<{
            stage: PerformanceStage
            percentage: number
        }> = []

        const checkStage = (s: PerformanceStage) => {
            const duration = s.duration || 0
            const percentage =
                totalDuration > 0 ? (duration / totalDuration) * 100 : 0

            // 瓶颈条件：耗时 > 10% 或 > 100ms
            if (percentage > 10 || duration > 100) {
                bottlenecks.push({ stage: s, percentage })
            }

            // 递归检查子阶段
            s.children.forEach(checkStage)
        }

        stage.children.forEach(checkStage)

        // 按耗时降序排序
        return bottlenecks.sort(
            (a, b) => (b.stage.duration || 0) - (a.stage.duration || 0)
        )
    }

    /**
     * 获取性能数据（用于外部分析）
     */
    public getData(): PerformanceStage | null {
        return this.rootStage
    }

    /**
     * 启用/禁用监控
     */
    public setEnabled(enabled: boolean): void {
        this.config.enabled = enabled
    }

    /**
     * 设置日志级别
     */
    public setLogLevel(level: "none" | "summary" | "detailed"): void {
        this.config.logLevel = level
    }
}

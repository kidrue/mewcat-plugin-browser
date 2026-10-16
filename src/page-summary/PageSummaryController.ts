import { sendMessage } from "@/messaging"
import { BackgroundResponseError } from "@/messaging/BackgroundResponseError"
import { captureExtensionException } from "@/monitoring"
import type { SummaryActionResult } from "@/reading/summaryActions"
import type { ExtensionConfig } from "@/types/config"
import { matchUrlPatternList } from "@/utils/help"

import { selectPageSummaryModel } from "../utils/pageSummary"
import { extractPageContent } from "./pageContent"
import { buildPageSummaryPrompt } from "./pageSummaryPrompts"
import {
    renderPageSummary,
    type PageSummaryHandle
} from "./PageSummaryRenderer"
import { classifyPageType } from "./pageTypes"
import { normalizeSummaryResult } from "./summaryResult"

export class PageSummaryController {
    private handle: PageSummaryHandle | null = null
    private pending: Promise<SummaryActionResult> | null = null
    private generation = 0

    constructor(private readonly config: ExtensionConfig) {}

    start(trigger: "auto" | "manual" = "auto"): Promise<SummaryActionResult> {
        if (this.pending) {
            if (trigger === "manual") this.handle?.open()
            return this.pending
        }
        const task = this.generate(trigger)
        this.pending = task
        const cleanup = () => {
            if (this.pending === task) this.pending = null
        }
        void task.then(cleanup, cleanup)
        return task
    }

    private async generate(
        trigger: "auto" | "manual"
    ): Promise<SummaryActionResult> {
        if (trigger === "auto" && !this.config.enablePageSummary)
            return { success: false, message: "自动总结未开启。" }
        if (!/^https?:$/.test(window.location.protocol))
            return { success: false, message: "此页面不支持总结。" }
        if (
            matchUrlPatternList(
                this.config.neverTranslateUrls ?? [],
                window.location.href
            ) ||
            matchUrlPatternList(
                this.config.pageSummaryDisabledSites ?? [],
                window.location.href
            )
        ) {
            return {
                success: false,
                message: "此网站已禁用总结，请在设置中解除禁用后使用。"
            }
        }

        const snapshot = extractPageContent(document)
        if (!snapshot.anchor || snapshot.text.length < 80)
            return { success: false, message: "页面正文不足，暂时无法总结。" }
        this.handle?.remove()
        const generation = ++this.generation
        const pageUrl = window.location.href
        const model = selectPageSummaryModel(this.config)
        if (!model) {
            this.handle = renderPageSummary(snapshot.anchor, {
                status: "unavailable"
            })
            if (trigger === "manual") this.handle.open()
            return {
                success: false,
                message: "请先配置可用的生成式 AI 模型。",
                needsConfiguration: true
            }
        }

        const pageType = classifyPageType(document)
        this.handle = renderPageSummary(snapshot.anchor, { status: "loading" })
        if (trigger === "manual") this.handle.open()
        try {
            const response = await sendMessage("model-gateway", {
                type: "generate",
                feature: "page-summary",
                model,
                messages: [
                    {
                        role: "user",
                        content: buildPageSummaryPrompt(
                            pageType,
                            snapshot.title,
                            snapshot.text,
                            this.config.targetLanguage
                        )
                    }
                ],
                enableThinking: this.config.enableThinking
            })
            if (!response.success && "error" in response) {
                throw new BackgroundResponseError(
                    response.error.code,
                    response.error.message
                )
            }
            const summary = normalizeSummaryResult(response.text)
            if (
                generation !== this.generation ||
                pageUrl !== window.location.href
            )
                return {
                    success: false,
                    message: "页面已变化，本次总结已取消。"
                }
            this.handle?.update(
                summary
                    ? { status: "success", summary, pageType }
                    : { status: "empty" }
            )
            return {
                success: Boolean(summary),
                message: summary
                    ? "总结已显示在页面中。"
                    : "未生成有效总结，请重试。"
            }
        } catch (error) {
            if (
                generation !== this.generation ||
                pageUrl !== window.location.href
            )
                return { success: false, message: "本次总结已取消。" }
            captureExtensionException(error, {
                feature: "page-summary",
                operation: "generate",
                pageUrl: location.href
            })
            this.handle?.update({ status: "error" })
            return { success: false, message: "页面总结失败，请重试。" }
        }
    }

    cancel(): void {
        this.generation++
        this.pending = null
        this.handle?.remove()
        this.handle = null
    }
}

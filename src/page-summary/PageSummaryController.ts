import { sendMessage } from "@/messaging"
import type { ExtensionConfig } from "@/types/config"

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

    constructor(private readonly config: ExtensionConfig) {}

    async start(): Promise<void> {
        if (!this.config.enablePageSummary) return
        if (!/^https?:$/.test(window.location.protocol)) return
        const hostname = window.location.hostname
        if (
            this.config.neverTranslateUrls?.includes(hostname) ||
            this.config.pageSummaryDisabledSites?.includes(hostname)
        ) {
            return
        }

        const snapshot = extractPageContent(document)
        if (!snapshot.anchor || snapshot.text.length < 80) return
        const model = selectPageSummaryModel(this.config)
        if (!model) {
            this.handle = renderPageSummary(snapshot.anchor, {
                status: "unavailable"
            })
            return
        }

        const pageType = classifyPageType(document)
        this.handle = renderPageSummary(snapshot.anchor, { status: "loading" })
        try {
            const response = await sendMessage("model-gateway", {
                type: "generate",
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
                throw new Error(response.error.message)
            }
            const summary = normalizeSummaryResult(response.text)
            this.handle.update(
                summary
                    ? { status: "success", summary, pageType }
                    : { status: "empty" }
            )
        } catch {
            this.handle.update({ status: "error" })
        }
    }

    cancel(): void {
        this.handle?.remove()
        this.handle = null
    }
}

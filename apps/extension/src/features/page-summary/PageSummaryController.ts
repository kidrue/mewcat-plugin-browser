import { MEWCAT_TRANSLATE_MODEL_ID } from "@/constants/translationServices"
import type { SummaryActionResult } from "@/features/reading/summaryActions"
import { sendMessage } from "@/messaging"
import { BackgroundResponseError } from "@/messaging/BackgroundResponseError"
import { requestMewCatCompletion } from "@/messaging/mewcatCompletion"
import { captureExtensionException } from "@/services/monitoring"
import type { ExtensionConfig } from "@/types/config"
import { matchUrlPatternList } from "@/utils/help"

import {
    PAGE_SUMMARY_UNAVAILABLE_MESSAGE,
    selectPageSummaryModel
} from "../../utils/pageSummary"
import { extractPageContent } from "./pageContent"
import {
    buildPageSummaryInstruction,
    buildPageSummaryPrompt
} from "./pageSummaryPrompts"
import {
    renderPageSummary,
    type PageSummaryHandle
} from "./PageSummaryRenderer"
import { classifyPageType } from "./pageTypes"
import { normalizeSummaryResult } from "./summaryResult"

const summaryConfigKey = (config: ExtensionConfig): string =>
    JSON.stringify({
        enabled: config.enablePageSummary,
        targetLanguage: config.targetLanguage,
        enableThinking: config.enableThinking,
        neverTranslateUrls: config.neverTranslateUrls,
        disabledSites: config.pageSummaryDisabledSites,
        serviceId: config.currentModel,
        model: selectPageSummaryModel(config)
    })

export class PageSummaryController {
    private handle: PageSummaryHandle | null = null
    private pending: Promise<SummaryActionResult> | null = null
    private generation = 0
    private completed: SummaryActionResult | null = null
    private pageUrl = window.location.href
    private configKey: string

    constructor(private config: ExtensionConfig) {
        this.configKey = summaryConfigKey(config)
    }

    updateConfig(config: ExtensionConfig): boolean {
        const nextKey = summaryConfigKey(config)
        this.config = config
        if (nextKey === this.configKey) return false
        this.configKey = nextKey
        this.cancel()
        return true
    }

    start(trigger: "auto" | "manual" = "auto"): Promise<SummaryActionResult> {
        if (this.pageUrl !== window.location.href) this.cancel()
        if (trigger === "auto" && !this.config.enablePageSummary)
            return Promise.resolve({
                success: false,
                message: "自动总结未开启。"
            })
        if (this.pending) {
            if (trigger === "manual") this.handle?.open()
            return this.pending
        }
        if (this.completed) {
            if (trigger === "manual") this.handle?.open()
            return Promise.resolve(this.completed)
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
        const useMewCat = this.config.currentModel === MEWCAT_TRANSLATE_MODEL_ID
        if (!model && !useMewCat) {
            this.handle = renderPageSummary(snapshot.anchor, {
                status: "unavailable"
            })
            if (trigger === "manual") this.handle.open()
            return {
                success: false,
                message: PAGE_SUMMARY_UNAVAILABLE_MESSAGE,
                needsConfiguration: true
            }
        }

        const pageType = classifyPageType(document)
        this.handle = renderPageSummary(snapshot.anchor, { status: "loading" })
        if (trigger === "manual") this.handle.open()
        try {
            const text =
                model && !useMewCat
                    ? await sendMessage("model-gateway", {
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
                      }).then(response => {
                          if (response.success === false)
                              throw new BackgroundResponseError(
                                  response.error.code,
                                  response.error.message
                              )
                          return response.text
                      })
                    : await requestMewCatCompletion({
                          feature: "page-summary",
                          input: {
                              messages: [
                                  {
                                      role: "system",
                                      content: buildPageSummaryInstruction(
                                          pageType,
                                          this.config.targetLanguage
                                      )
                                  },
                                  {
                                      role: "user",
                                      content: `标题：${snapshot.title.slice(0, 500)}\n\n${snapshot.text}`
                                  }
                              ]
                          }
                      })
            const summary = normalizeSummaryResult(text)
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
            const result = {
                success: Boolean(summary),
                message: summary
                    ? "总结已显示在页面中。"
                    : "未生成有效总结，请重试。"
            }
            if (result.success) this.completed = result
            return result
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
            return {
                success: false,
                message:
                    useMewCat && error instanceof BackgroundResponseError
                        ? error.message
                        : "页面总结失败，请重试。"
            }
        }
    }

    cancel(): void {
        this.generation++
        this.pending = null
        this.completed = null
        this.pageUrl = window.location.href
        this.handle?.remove()
        this.handle = null
    }
}

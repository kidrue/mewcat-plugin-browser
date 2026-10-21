// @vitest-environment jsdom
import { createRoot } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MonitoringErrorBoundary } from "@/components/MonitoringErrorBoundary"

const containers: HTMLElement[] = []

afterEach(() => {
    containers.splice(0).forEach(container => container.remove())
    vi.restoreAllMocks()
})

describe("monitoring error boundary", () => {
    it("reports a React render error once and keeps a visible fallback", async () => {
        const container = document.createElement("div")
        containers.push(container)
        document.body.append(container)
        const capture = vi.fn()
        const root = createRoot(container)
        const Broken = () => {
            throw new Error("render failed")
        }
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
        const suppressJSDOMError = (event: Event) => event.preventDefault()
        window.addEventListener("error", suppressJSDOMError)
        try {
            await act(async () => {
                root.render(
                    <MonitoringErrorBoundary
                        feature="options"
                        operation="render"
                        capture={capture}
                    >
                        <Broken />
                    </MonitoringErrorBoundary>
                )
            })
            expect(capture).toHaveBeenCalledTimes(1)
            expect(container.textContent).toContain("出错了")
        } finally {
            await act(async () => root.unmount())
            window.removeEventListener("error", suppressJSDOMError)
            consoleError.mockRestore()
        }
    })
})

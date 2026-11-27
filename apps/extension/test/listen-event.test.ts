import { expect, it } from "vitest"

import { ListenEvent } from "../src/features/page-translation/ListenEvent"

it("removes only the requested event callback", () => {
    const events = new ListenEvent<{ onChange: (value: unknown) => void }>()
    const received: unknown[] = []
    const removed = (value: unknown) => received.push(["removed", value])
    const retained = (value: unknown) => received.push(["retained", value])
    events.addEventListener("onChange", removed)
    events.addEventListener("onChange", retained)
    events.removeEventListener("onChange", removed)
    events.dispatchEvent("onChange", 1)
    expect(received).toEqual([["retained", 1]])
})

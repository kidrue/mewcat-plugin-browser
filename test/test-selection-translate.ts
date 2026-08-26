import assert from "node:assert/strict"

import { NAVIGATION_ITEMS } from "../src/constants/options"
import { defaultExtensionConfig } from "../src/state/constants"
import * as selectionTranslation from "../src/translation/selectionTranslation"
import * as domUtils from "../src/utils/dom"

assert.equal(
    defaultExtensionConfig.selectionTriggerMode,
    "direct",
    "Fresh installations must translate selected text immediately"
)
assert.equal(
    NAVIGATION_ITEMS.some(item => item.id === "selection"),
    true,
    "Options navigation must expose selection translation settings"
)

Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
        innerWidth: 375,
        innerHeight: 667
    }
})

const anchorRect = {
    top: 100,
    left: 300,
    width: 50,
    height: 20
} as DOMRect
const panelRect = {
    top: 0,
    left: 0,
    width: 338,
    height: 120
} as DOMRect

assert.deepEqual(
    domUtils.calculatePosition(anchorRect, panelRect),
    { top: 136, left: 29 },
    "Selection panels near the right edge must stay inside an 8px viewport margin"
)

const isSelectionUiEvent = (
    domUtils as typeof domUtils & {
        isSelectionUiEvent?: (
            event: Pick<Event, "composedPath">,
            elements: Array<EventTarget | null>
        ) => boolean
    }
).isSelectionUiEvent
assert.equal(
    typeof isSelectionUiEvent,
    "function",
    "The selection hook must expose a testable Shadow DOM event boundary"
)

const panel = new EventTarget()
const panelChild = new EventTarget()
const page = new EventTarget()
assert.equal(
    isSelectionUiEvent?.(
        { composedPath: () => [panelChild, panel] } as Pick<
            Event,
            "composedPath"
        >,
        [panel, null]
    ),
    true,
    "Events composed through the selection panel must count as internal"
)
assert.equal(
    isSelectionUiEvent?.(
        { composedPath: () => [page] } as Pick<Event, "composedPath">,
        [panel, null]
    ),
    false,
    "Page events outside the selection UI must remain external"
)

const getSelectionSnapshot = (
    domUtils as typeof domUtils & {
        getSelectionSnapshot?: (
            selection: Pick<
                Selection,
                "toString" | "rangeCount" | "getRangeAt"
            > | null
        ) => { text: string; rect: DOMRect } | null
    }
).getSelectionSnapshot
assert.equal(
    typeof getSelectionSnapshot,
    "function",
    "Selection reading must have a testable null-safe boundary"
)
assert.equal(getSelectionSnapshot?.(null), null)
assert.equal(
    getSelectionSnapshot?.({
        rangeCount: 0,
        toString: () => "stale text",
        getRangeAt: () => {
            throw new Error("getRangeAt must not run without a range")
        }
    }),
    null,
    "A selection without a range must not call getRangeAt"
)

const notifySelectionTranslationFinished = (
    selectionTranslation as typeof selectionTranslation & {
        notifySelectionTranslationFinished?: (callback?: () => void) => void
    }
).notifySelectionTranslationFinished
assert.equal(
    typeof notifySelectionTranslationFinished,
    "function",
    "Selection completion callbacks need a null-safe boundary"
)
assert.doesNotThrow(
    () => notifySelectionTranslationFinished?.(),
    "A successful translation must not crash when onFinished is omitted"
)
let finishedCount = 0
notifySelectionTranslationFinished?.(() => {
    finishedCount += 1
})
assert.equal(finishedCount, 1)

const getSelectionPanelVisibility = (
    selectionTranslation as typeof selectionTranslation & {
        getSelectionPanelVisibility?: (
            isVisible: boolean
        ) => "visible" | "hidden"
    }
).getSelectionPanelVisibility
assert.equal(
    typeof getSelectionPanelVisibility,
    "function",
    "Selection panel focus visibility must have a testable boundary"
)
assert.equal(getSelectionPanelVisibility?.(false), "hidden")
assert.equal(getSelectionPanelVisibility?.(true), "visible")

console.log("Selection translation interaction tests passed")

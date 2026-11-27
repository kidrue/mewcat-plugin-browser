// @vitest-environment jsdom
import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import SidePanel from "../src/pages/sidepanel"
import { AiRole } from "../src/types/config"

const mocks = vi.hoisted(() => ({ translate: vi.fn() }))
const config = {
    targetLanguage: "ja",
    detectedLanguage: "en",
    currentModel: "mewcat-translate",
    aiModelList: [],
    aiRole: AiRole.NEWS_TRANSLATOR,
    enableAutoAiRole: true
}
vi.mock("@/state/config", () => ({
    useConfig: () => config
}))
vi.mock(
    "@/features/translation-services/translationService",
    async importOriginal => ({
        ...(await importOriginal<
            typeof import("@/features/translation-services/translationService")
        >()),
        translateText: mocks.translate
    })
)
vi.mock("@/components/BrandLogo", () => ({ default: () => null }))
vi.mock("@/components/TranslationMark", () => ({ default: () => null }))

let root: ReturnType<typeof createRoot>
beforeEach(() => {
    mocks.translate.mockReset().mockResolvedValue("译文")
    config.currentModel = "mewcat-translate"
    localStorage.clear()
})
afterEach(async () => {
    await act(async () => root?.unmount())
    vi.useRealTimers()
    vi.clearAllMocks()
})
async function render() {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    document.body.innerHTML = "<div id='host'></div>"
    root = createRoot(document.getElementById("host")!)
    await act(async () => root.render(<SidePanel />))
}
function button(text: string) {
    return [...document.querySelectorAll("button")].find(
        b => b.textContent?.trim() === text
    )!
}
async function input(text: string) {
    const el = document.querySelector("textarea")!
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            "value"
        )!.set!.call(el, text)
        el.dispatchEvent(new Event("input", { bubbles: true }))
    })
}

function labeledButton(label: string) {
    return document.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`
    )!
}

function roleTag(label: string) {
    return [
        ...document.querySelectorAll<HTMLButtonElement>(
            '[aria-label="常用翻译角色"] button[aria-pressed]'
        )
    ].find(tag => tag.textContent === label)
}

async function selectOption(label: string, option: string) {
    const trigger = labeledButton(label)
    expect(trigger).not.toBeNull()
    await act(async () => trigger.click())
    const choice = [
        ...document.querySelectorAll<HTMLButtonElement>('[role="option"]')
    ].find(item => item.textContent === option)
    expect(choice).toBeDefined()
    await act(async () => choice!.click())
}

async function pressEnter(options: KeyboardEventInit = {}) {
    const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        ...options
    })
    await act(async () =>
        document.querySelector("textarea")!.dispatchEvent(event)
    )
    return event.defaultPrevented
}

// jsdom 不执行系统粘贴的默认插入；模拟默认编辑后发出原生 input 事件。
async function paste(
    text: string,
    options: {
        ctrlKey?: boolean
        metaKey?: boolean
        cancel?: boolean
        unchanged?: boolean
    } = {}
) {
    const el = document.querySelector("textarea")!
    const event = new Event("paste", { bubbles: true, cancelable: true })
    Object.defineProperty(event, "clipboardData", {
        value: {
            getData: (type: string) => (type === "text/plain" ? text : "")
        }
    })
    if (options.cancel) event.preventDefault()
    await act(async () => {
        if (options.ctrlKey || options.metaKey)
            el.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "v",
                    bubbles: true,
                    ...options
                })
            )
        el.dispatchEvent(event)
        if (!event.defaultPrevented && text) {
            const start = el.selectionStart,
                end = el.selectionEnd
            const value = el.value.slice(0, start) + text + el.value.slice(end)
            Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype,
                "value"
            )!.set!.call(el, value)
            el.setSelectionRange(start + text.length, start + text.length)
            if (!options.unchanged)
                el.dispatchEvent(
                    new InputEvent("input", {
                        bubbles: true,
                        inputType: "insertFromPaste",
                        data: text
                    })
                )
        }
    })
    return event
}
async function finishPaste() {
    await act(async () => vi.runOnlyPendingTimersAsync())
}

it.each([
    ["Windows Ctrl+V", { ctrlKey: true }],
    ["macOS Cmd+V", { metaKey: true }],
    ["context menu", {}]
] as const)(
    "automatically translates native paste via %s once",
    async (_label, keys) => {
        vi.useFakeTimers()
        await render()
        const event = await paste("hello", keys)
        expect(event.defaultPrevented).toBe(false)
        await finishPaste()
        expect(mocks.translate).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ sourceLanguage: "auto" }),
            [{ role: "user", content: "hello" }],
            "ja"
        )
        expect(document.querySelector("textarea")!.value).toBe("hello")
        expect(document.body.textContent).toContain("译文")
    }
)
it.each([
    [6, 11, "hello friend"],
    [6, 6, "hello friendworld"]
] as const)(
    "translates the full native edit at selection %s..%s",
    async (start, end, expected) => {
        vi.useFakeTimers()
        await render()
        await input("hello world")
        document.querySelector("textarea")!.setSelectionRange(start, end)
        await paste("friend")
        await finishPaste()
        expect(mocks.translate.mock.calls[0][1]).toEqual([
            { role: "user", content: expected }
        ])
        expect(document.querySelector("textarea")!.selectionStart).toBe(12)
    }
)
it("translates an identical replacement even without a change event", async () => {
    vi.useFakeTimers()
    await render()
    await input("hello")
    document.querySelector("textarea")!.select()
    await paste("hello", { unchanged: true })
    await finishPaste()
    expect(mocks.translate).toHaveBeenCalledTimes(1)
})
it("replaces input and translates when the paste button reads the clipboard", async () => {
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { readText: vi.fn().mockResolvedValue("new text") }
    })
    await render()
    await input("old text")
    await act(async () => button("粘贴").click())
    expect(document.querySelector("textarea")!.value).toBe("new text")
    expect(mocks.translate.mock.calls[0][1]).toEqual([
        { role: "user", content: "new text" }
    ])
})
it.each(["", " \n "])("does not translate empty paste %j", async text => {
    vi.useFakeTimers()
    await render()
    await paste(text)
    await finishPaste()
    expect(mocks.translate).not.toHaveBeenCalled()
})
it("does not automatically translate ordinary typing or a canceled paste", async () => {
    vi.useFakeTimers()
    await render()
    await input("typed text")
    await paste("canceled", { cancel: true })
    await finishPaste()
    expect(mocks.translate).not.toHaveBeenCalled()
})
it("replaces pending paste work and ignores a late translation", async () => {
    vi.useFakeTimers()
    let resolve!: (text: string) => void
    mocks.translate
        .mockReturnValueOnce(
            new Promise<string>(done => {
                resolve = done
            })
        )
        .mockResolvedValueOnce("最新译文")
    await render()
    await paste("first")
    await finishPaste()
    document.querySelector("textarea")!.select()
    await paste("second")
    document.querySelector("textarea")!.select()
    await paste("third")
    await finishPaste()
    expect(mocks.translate).toHaveBeenCalledTimes(2)
    expect(mocks.translate.mock.calls[1][1]).toEqual([
        { role: "user", content: "third" }
    ])
    await act(async () => resolve("旧译文"))
    expect(document.body.textContent).toContain("最新译文")
    expect(document.body.textContent).not.toContain("旧译文")
})
it.each(["clear", "edit", "language", "unmount"])(
    "cancels queued paste translation after %s",
    async action => {
        vi.useFakeTimers()
        await render()
        await paste("hello")
        if (action === "clear")
            await act(async () =>
                document
                    .querySelector<HTMLButtonElement>('[title="清空"]')!
                    .click()
            )
        if (action === "edit") await input("manual edit")
        if (action === "language") await selectOption("目标语言", "英语")
        if (action === "unmount") await act(async () => root.unmount())
        await finishPaste()
        expect(mocks.translate).not.toHaveBeenCalled()
    }
)
it("ignores an old clipboard read after a newer paste button click", async () => {
    let resolve!: (text: string) => void
    const readText = vi
        .fn()
        .mockReturnValueOnce(
            new Promise<string>(done => {
                resolve = done
            })
        )
        .mockResolvedValueOnce("new text")
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { readText }
    })
    await render()
    await act(async () => button("粘贴").click())
    await act(async () => button("粘贴").click())
    await act(async () => resolve("stale text"))
    expect(document.querySelector("textarea")!.value).toBe("new text")
    expect(mocks.translate).toHaveBeenCalledTimes(1)
})
it("lets users retry a failed automatic translation manually", async () => {
    vi.useFakeTimers()
    mocks.translate
        .mockRejectedValueOnce(new Error("temporary failure"))
        .mockResolvedValueOnce("重试译文")
    await render()
    await paste("hello")
    await finishPaste()
    expect(document.body.textContent).toContain("temporary failure")
    await act(async () => button("翻译").click())
    expect(mocks.translate).toHaveBeenCalledTimes(2)
    expect(document.body.textContent).toContain("重试译文")
})
it.each([{}, { ctrlKey: true }, { metaKey: true }])(
    "translates from the input with Enter and modifiers %j",
    async keys => {
        await render()
        await input("hello")
        expect(await pressEnter(keys)).toBe(true)
        expect(mocks.translate).toHaveBeenCalledTimes(1)
    }
)

it.each([{ shiftKey: true }, { isComposing: true }])(
    "leaves Enter to the editor when %j",
    async keys => {
        await render()
        await input("hello")
        expect(await pressEnter(keys)).toBe(false)
        expect(mocks.translate).not.toHaveBeenCalled()
    }
)

it("ignores repeated Enter after a translation finishes", async () => {
    await render()
    await input("hello")
    await pressEnter()
    await pressEnter({ repeat: true })
    expect(mocks.translate).toHaveBeenCalledTimes(1)
})

it("defaults independently to standard translation", async () => {
    await render()
    expect(labeledButton("翻译角色").textContent).toBe("标准翻译")
    await input("hello")
    await pressEnter()
    expect(mocks.translate.mock.calls[0][0]).toMatchObject({
        aiRole: AiRole.DEFAULT,
        enableAutoAiRole: false
    })
    expect(config.aiRole).toBe(AiRole.NEWS_TRANSLATOR)
})

it("uses the selected role for automatic paste translation", async () => {
    vi.useFakeTimers()
    await render()
    await selectOption("翻译角色", "意译大师")
    expect(labeledButton("翻译角色").textContent).toBe("意译大师")
    expect(mocks.translate).not.toHaveBeenCalled()
    await paste("hello")
    await finishPaste()
    expect(mocks.translate.mock.calls[0][0]).toMatchObject({
        aiRole: AiRole.FREE_TRANSLATOR,
        enableAutoAiRole: false
    })
})

it("restores pinned roles on reopen and removes unpinned tags", async () => {
    await render()
    await selectOption("添加常用翻译角色", "意译大师")
    expect(labeledButton("翻译角色").textContent).toBe("标准翻译")
    await act(async () => root.unmount())
    await render()
    expect(labeledButton("翻译角色").textContent).toBe("标准翻译")
    await act(async () => roleTag("意译大师")!.click())
    expect(labeledButton("翻译角色").textContent).toBe("意译大师")
    expect(roleTag("意译大师")?.getAttribute("aria-pressed")).toBe("true")
    await act(async () => labeledButton("从常用翻译角色移除意译大师").click())
    await act(async () => root.unmount())
    await render()
    expect(roleTag("意译大师")).toBeUndefined()
    expect(roleTag("标准翻译")).toBeDefined()
})

it("filters unpinned roles by label or identifier and appends them before the add button", async () => {
    await render()
    await selectOption("添加常用翻译角色", "意译大师")
    const add = labeledButton("添加常用翻译角色")
    await act(async () => add.click())
    const options = () =>
        [...document.querySelectorAll('[role="option"]')].map(
            option => option.textContent
        )
    expect(options()).not.toContain("标准翻译")
    expect(options()).not.toContain("意译大师")

    const search = document.querySelector<HTMLInputElement>(
        'input[aria-label="搜索翻译角色"]'
    )!
    await vi.waitFor(() => expect(document.activeElement).toBe(search))
    const searchFor = async (query: string) => {
        await act(async () => {
            Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                "value"
            )!.set!.call(search, query)
            search.dispatchEvent(new Event("input", { bubbles: true }))
        })
    }
    await searchFor("科技")
    expect(options()).toEqual(["科技翻译"])
    await searchFor(" GITHUB_TRANSLATOR ")
    expect(options()).toEqual(["GitHub翻译"])
    await act(async () =>
        document.querySelector<HTMLButtonElement>('[role="option"]')!.click()
    )

    expect(search.isConnected).toBe(false)
    expect(roleTag("意译大师")?.parentElement?.nextElementSibling).toBe(
        roleTag("GitHub翻译")?.parentElement
    )
    expect(
        add
            .closest('[aria-label="常用翻译角色"]')
            ?.lastElementChild?.contains(add)
    ).toBe(true)
    expect(labeledButton("翻译角色").textContent).toBe("标准翻译")
})

it("lists the most common translation roles first", async () => {
    await render()
    await act(async () => labeledButton("翻译角色").click())
    expect(
        [...document.querySelectorAll('[role="option"]')]
            .slice(0, 10)
            .map(option => option.textContent)
    ).toEqual([
        "标准翻译",
        "意译大师",
        "段落总结",
        "英文简化",
        "词汇助手",
        "科技翻译",
        "GitHub翻译",
        "学术论文",
        "新闻媒体",
        "小说翻译"
    ])
})

it("uses source and target options from the sidebar dropdowns", async () => {
    await render()
    await selectOption("源语言", "英语")
    await selectOption("目标语言", "法语")
    await input("hello")
    await pressEnter()
    expect(mocks.translate.mock.calls[0][0].sourceLanguage).toBe("en")
    expect(mocks.translate.mock.calls[0][2]).toBe("fr")
})

it("removes a pinned tag without changing the selected role", async () => {
    await render()
    await selectOption("添加常用翻译角色", "意译大师")
    await selectOption("翻译角色", "意译大师")
    const remove = labeledButton("从常用翻译角色移除意译大师")
    expect(remove).not.toBeNull()
    await act(async () => {
        remove.focus()
        remove.click()
    })
    expect(roleTag("意译大师")).toBeUndefined()
    expect(labeledButton("翻译角色").textContent).toBe("意译大师")
    expect(document.activeElement).toBe(roleTag("标准翻译"))
    await act(async () => root.unmount())
    await render()
    expect(roleTag("意译大师")).toBeUndefined()
    expect(labeledButton("从常用翻译角色移除标准翻译")).toBeNull()
})

it("can remove a pinned role even when the current engine disables role selection", async () => {
    await render()
    await selectOption("添加常用翻译角色", "意译大师")
    await act(async () => root.unmount())
    config.currentModel = "google-translate"
    await render()
    expect(roleTag("意译大师")?.disabled).toBe(true)
    expect(labeledButton("添加常用翻译角色").disabled).toBe(true)
    const remove = labeledButton("从常用翻译角色移除意译大师")
    expect(remove.disabled).toBe(false)
    await act(async () => remove.click())
    expect(roleTag("意译大师")).toBeUndefined()
})

it("limits engines without role support to standard translation", async () => {
    config.currentModel = "google-translate"
    await render()
    expect(labeledButton("翻译角色").disabled).toBe(true)
    expect(document.body.textContent).toContain("切换到支持角色的翻译服务")
    await input("hello")
    await pressEnter()
    expect(mocks.translate.mock.calls[0][0]).toMatchObject({
        currentModel: "google-translate",
        aiRole: AiRole.DEFAULT
    })
})

it("ignores a pending result when switching roles", async () => {
    let resolve!: (value: string) => void
    mocks.translate.mockReturnValueOnce(
        new Promise<string>(done => {
            resolve = done
        })
    )
    await render()
    await input("hello")
    await pressEnter()
    await selectOption("翻译角色", "意译大师")
    await act(async () => resolve("旧角色译文"))
    expect(document.body.textContent).not.toContain("旧角色译文")
    expect(document.querySelector("textarea")!.value).toBe("hello")
    await pressEnter()
    expect(mocks.translate.mock.calls[1][0].aiRole).toBe(AiRole.FREE_TRANSLATOR)
})
it("inherits target language and rejects a result after clearing the input", async () => {
    let resolve!: (value: string) => void
    mocks.translate.mockReturnValue(
        new Promise<string>(r => {
            resolve = r
        })
    )
    await render()
    await input("hello")
    await act(async () => button("翻译").click())
    expect(mocks.translate.mock.calls[0][2]).toBe("ja")
    await act(async () =>
        document.querySelector<HTMLButtonElement>('[title="清空"]')!.click()
    )
    await act(async () => resolve("旧结果"))
    expect(document.body.textContent).not.toContain("旧结果")
    expect(button("翻译").disabled).toBe(true)
})
it("explains clipboard read failures", async () => {
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { readText: vi.fn().mockRejectedValue(new Error("denied")) }
    })
    await render()
    await act(async () => button("粘贴").click())
    expect(document.body.textContent).toContain("请使用 Ctrl+V")
})
it("keeps the newest result when an older request finishes later", async () => {
    let resolve!: (value: string) => void
    mocks.translate
        .mockReturnValueOnce(
            new Promise<string>(r => {
                resolve = r
            })
        )
        .mockResolvedValueOnce("新译文")
    await render()
    await input("first")
    await act(async () => button("翻译").click())
    await input("second")
    await act(async () => button("翻译").click())
    await act(async () => resolve("旧译文"))
    expect(document.body.textContent).toContain("新译文")
    expect(document.body.textContent).not.toContain("旧译文")
})
it("explains clipboard write failures", async () => {
    mocks.translate.mockResolvedValueOnce("译文")
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }
    })
    await render()
    await input("hello")
    await act(async () => button("翻译").click())
    await act(async () => button("复制").click())
    expect(document.body.textContent).toContain("复制失败")
})

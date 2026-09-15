import type { TranslationNode } from "../../src/translation/DOMTraverser"
import { ViewportTranslationScheduler } from "../../src/translation/ViewportTranslationScheduler"

const stage = document.querySelector<HTMLDivElement>("#stage")!
const report = document.querySelector<HTMLPreElement>("#report")!
const button = document.querySelector<HTMLButtonElement>("#run")!
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
let scheduler: ViewportTranslationScheduler | undefined

button.onclick = async () => {
    button.disabled = true
    report.textContent = "运行中"
    const lines: string[] = []
    const check = (condition: boolean, label: string, details: unknown) => {
        lines.push(
            `${condition ? "PASS" : "FAIL"} ${label} ${JSON.stringify(details)}`
        )
        report.textContent = lines.join("\n")
    }
    function fixture() {
        scheduler?.destroy()
        stage.replaceChildren()
        stage.style.height = "300px"
        stage.scrollTop = 0
        const sent: number[] = []
        const nodes: TranslationNode[] = Array.from(
            { length: 40 },
            (_, index) => {
                const container = document.createElement("p")
                container.textContent = `Paragraph ${index}: This is a complete source paragraph for testing reading translation.`
                stage.append(container)
                return {
                    id: String(index),
                    originText: container.textContent,
                    container,
                    textNodes: [
                        {
                            type: "text",
                            element: container.firstChild as HTMLElement,
                            content: container.textContent
                        }
                    ],
                    insertPosition: "after" as TranslationNode["insertPosition"]
                }
            }
        )
        scheduler = new ViewportTranslationScheduler({
            viewportOnly: true,
            getLimits: () => ({
                maxRequestsPerSecond: 100,
                maxConcurrent: 2,
                maxTextLengthPerRequest: 1
            }),
            readCache: async () => null,
            writeCache: async () => {},
            translate: async batch => {
                sent.push(...batch.map(node => Number(node.id)))
                await sleep(2)
                return batch.map(() => "译文")
            },
            render: () => {},
            onError: error => {
                throw error
            }
        })
        scheduler.add(nodes)
        return { sent, nodes }
    }
    try {
        let { sent } = fixture()
        await sleep(250)
        check(
            JSON.stringify(sent) === "[0,1,2,3,4,5]",
            "初始只请求内层当前屏与下一屏",
            sent
        )
        const count = sent.length
        for (let index = 1; index <= 4; index++) {
            stage.scrollTop = index * 600
            await sleep(35)
        }
        await sleep(80)
        check(
            sent.length === count,
            "快速滚动途中无新增请求",
            sent.slice(count)
        )
        await sleep(250)
        check(
            sent.includes(24) &&
                sent.slice(count).every(index => index >= 21 && index <= 29),
            "停止后只补译新位置上下各一屏",
            sent.slice(count)
        )
        ;({ sent } = fixture())
        await sleep(250)
        stage.style.height = "450px"
        await sleep(300)
        check(
            sent.includes(8) && !sent.includes(9),
            "内层容器变高后按新屏高预取",
            sent
        )

        scheduler?.destroy()
        const frozen = sent.length
        stage.scrollTop = 3000
        await sleep(300)
        check(sent.length === frozen, "销毁后滚动不再请求", sent.length)
        report.textContent = `${lines.join("\n")}\n${lines.some(line => line.startsWith("FAIL")) ? "验收失败" : "全部通过"}`
    } catch (error) {
        report.textContent += `\nERROR ${String(error)}`
    } finally {
        scheduler?.destroy()
        button.disabled = false
    }
}

const storageKey = "mewcat-example-acceptance-v1"
const checks = [...document.querySelectorAll("[data-check]")]
const storageStatus = document.querySelector("#storage-status")

function updateProgress() {
    const count = checks.filter(input => input.checked).length
    document.querySelector("#progress").value = count
    document.querySelector("#progress-label").textContent =
        `已验收 ${count} / ${checks.length}`
}

function saveChecks() {
    updateProgress()
    try {
        localStorage.setItem(
            storageKey,
            JSON.stringify(
                checks
                    .filter(input => input.checked)
                    .map(input => input.dataset.check)
            )
        )
        storageStatus.textContent = ""
    } catch {
        storageStatus.textContent =
            "浏览器未允许保存记录，本次勾选仅在当前页面有效。"
    }
}

try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]")
    if (Array.isArray(saved)) {
        for (const input of checks)
            input.checked = saved.includes(input.dataset.check)
    }
} catch {
    storageStatus.textContent = "无法读取历史记录，本次从未验收状态开始。"
}
updateProgress()
for (const input of checks) input.addEventListener("change", saveChecks)
document.querySelector("#reset-checks").addEventListener("click", () => {
    for (const input of checks) input.checked = false
    saveChecks()
})

const content = document.querySelector("#dynamic-content")
const status = document.querySelector("#dynamic-status")
const original = content.textContent.trim()
let sequence = 0

function paragraph(text) {
    const element = document.createElement("p")
    element.textContent = text
    return element
}

document.querySelector("#append-content").addEventListener("click", () => {
    sequence += 1
    content.append(
        paragraph(
            `Community update ${sequence}: This Saturday, volunteers will meet beside the river to plant trees and repair the footpath. Everyone is welcome to join the morning walk and share ideas for a greener neighborhood.`
        )
    )
    status.textContent = `已追加第 ${sequence} 条动态素材`
})
document.querySelector("#replace-content").addEventListener("click", () => {
    sequence += 1
    content.replaceChildren(
        paragraph(
            `Schedule revision ${sequence}: The outdoor reading event has moved to the library because of heavy rain. The starting time is now three in the afternoon. Please bring your favorite book and a reusable cup.`
        )
    )
    status.textContent = `已替换为第 ${sequence} 版素材`
})
document.querySelector("#reset-content").addEventListener("click", () => {
    sequence = 0
    content.replaceChildren(paragraph(original))
    status.textContent = "初始素材"
})

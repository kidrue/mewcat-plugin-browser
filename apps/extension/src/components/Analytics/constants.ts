export const trends = [
    {
        label: "设备活跃",
        series: [
            { key: "activeDevices", label: "活跃设备" },
            { key: "firstTranslationDevices", label: "首次翻译设备" }
        ]
    },
    {
        label: "翻译页面",
        series: [{ key: "pages", label: "翻译页面" }]
    },
    {
        label: "安装与卸载",
        series: [
            { key: "installs", label: "新增安装" },
            { key: "uninstalls", label: "确认卸载" }
        ]
    }
] as const

export const dailyColumns = [
    { key: "installs", label: "新增安装" },
    { key: "uninstalls", label: "确认卸载" },
    { key: "activeDevices", label: "活跃设备" },
    { key: "firstTranslationDevices", label: "首次翻译设备" },
    { key: "pages", label: "翻译页面" }
] as const

// 仅为作者设备添加显示标签；管理员授权仍由服务端独立校验。
export const authorDevices = new Set([
    "37156ad6-e1c6-4628-8ec3-55b329f4f1a3",
    "76aa2488-3241-4f38-b0a6-4f5df933417b"
])

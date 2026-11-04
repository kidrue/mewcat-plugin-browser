export async function copyDeviceId(clientId: string): Promise<string> {
    try {
        if (!navigator.clipboard?.writeText)
            return "复制不可用，请手动选择设备 ID"
        await navigator.clipboard.writeText(clientId)
        return "设备 ID 已复制"
    } catch {
        return "复制失败，请手动选择设备 ID"
    }
}

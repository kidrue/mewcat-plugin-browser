/** 本地产物统一使用扩展名称、版本及北京时间（精确到秒）。 */
function createArtifactFileName(manifest, extension, now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(now)
    const date = Object.fromEntries(parts.map(part => [part.type, part.value]))
    const timestamp = `${date.year}${date.month}${date.day} ${date.hour}${date.minute}${date.second}`
    return `${manifest.name}-${manifest.version}-${timestamp}.${extension}`
}

module.exports = { createArtifactFileName }

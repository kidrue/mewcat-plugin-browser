/** 本地产物优先使用扩展短名称，结合版本及北京时间（精确到秒）。 */
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
    const name = manifest.short_name || manifest.name
    return `${name}-${manifest.version}-${timestamp}.${extension}`
}

module.exports = { createArtifactFileName }

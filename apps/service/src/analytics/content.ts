import {
    createCipheriv,
    createDecipheriv,
    createHmac,
    hkdfSync,
    randomBytes
} from "node:crypto"

export function createContentCipher(encodedKey: string) {
    const key = Buffer.from(encodedKey, "base64")
    if (key.length !== 32 || key.toString("base64") !== encodedKey)
        throw new Error("画像内容密钥必须为 32 字节标准 Base64")
    const digestKey = Buffer.from(
        hkdfSync("sha256", key, Buffer.alloc(0), "mewcat-content-digest-v1", 32)
    )
    const aad = (id: string, kind: string) =>
        Buffer.from(JSON.stringify(["v1", id, kind]))
    return {
        encrypt(id: string, kind: "original" | "translated", texts: string[]) {
            const iv = randomBytes(12)
            const cipher = createCipheriv("aes-256-gcm", key, iv)
            cipher.setAAD(aad(id, kind))
            const bytes = Buffer.concat([
                cipher.update(JSON.stringify(texts), "utf8"),
                cipher.final()
            ])
            return [
                "v1",
                iv.toString("base64url"),
                cipher.getAuthTag().toString("base64url"),
                bytes.toString("base64url")
            ].join(".")
        },
        decrypt(
            id: string,
            kind: "original" | "translated",
            encoded: string
        ): string[] {
            const [version, iv, tag, bytes, extra] = encoded.split(".")
            if (version !== "v1" || !iv || !tag || !bytes || extra)
                throw new Error("无效内容密文")
            const decipher = createDecipheriv(
                "aes-256-gcm",
                key,
                Buffer.from(iv, "base64url")
            )
            decipher.setAAD(aad(id, kind))
            decipher.setAuthTag(Buffer.from(tag, "base64url"))
            const value: unknown = JSON.parse(
                Buffer.concat([
                    decipher.update(Buffer.from(bytes, "base64url")),
                    decipher.final()
                ]).toString("utf8")
            )
            if (
                !Array.isArray(value) ||
                !value.every(text => typeof text === "string")
            )
                throw new Error("无效内容数据")
            return value
        },
        digest(texts: string[]) {
            return createHmac("sha256", digestKey)
                .update(
                    JSON.stringify(
                        texts.map(text =>
                            text.normalize("NFKC").replace(/\s+/gu, " ").trim()
                        )
                    )
                )
                .digest("hex")
        }
    }
}

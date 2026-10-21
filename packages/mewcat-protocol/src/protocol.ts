import {
    base64url,
    compactDecrypt,
    CompactEncrypt,
    CompactSign,
    compactVerify,
    decodeProtectedHeader,
    exportJWK,
    generateKeyPair
} from "jose"
import { z } from "zod"

export interface Identity {
    signing: CryptoKeyPair
    encryption: CryptoKeyPair
}
const encoder = new TextEncoder()
const decoder = new TextDecoder("utf-8", { fatal: true })
const coordinate = z.string().regex(/^[A-Za-z0-9_-]{43}$/)

export const signingPublicKeySchema = z.strictObject({
    kty: z.literal("EC"),
    crv: z.literal("P-256"),
    x: coordinate,
    y: coordinate
})
export const encryptionPublicKeySchema = z.strictObject({
    kty: z.literal("RSA"),
    e: z.literal("AQAB"),
    n: z
        .string()
        .regex(/^[A-Za-z0-9_-]{342,683}$/)
        .refine(value => {
            const bytes = base64url.decode(value)
            return [256, 384, 512].includes(bytes.length) && bytes[0]! >= 128
        }, "RSA modulus must be 2048, 3072 or 4096 bits")
})
export const nonceSchema = z.string().regex(/^[A-Za-z0-9_-]{22,64}$/)
export const requestSchema = z.strictObject({
    v: z.literal(1),
    method: z.literal("POST"),
    path: z.string().max(100),
    timestamp: z.number().int().nonnegative().safe(),
    nonce: nonceSchema,
    data: z.unknown()
})
export type SignedRequest = z.infer<typeof requestSchema>
export const errorSchema = z.strictObject({
    code: z.string(),
    message: z.string()
})
const responseBase = {
    v: z.literal(1),
    nonce: nonceSchema,
    path: z.string(),
    timestamp: z.number().int().safe()
}
export const responseSchema = z.discriminatedUnion("ok", [
    z.strictObject({ ...responseBase, ok: z.literal(true), data: z.unknown() }),
    z.strictObject({
        ...responseBase,
        ok: z.literal(false),
        error: errorSchema
    })
])
export const serverKeysSchema = z.strictObject({
    version: z.literal(1),
    keyId: z.string().min(1).max(100),
    signingKey: signingPublicKeySchema,
    encryptionKey: encryptionPublicKeySchema
})
export type ServerPublicKeys = z.infer<typeof serverKeysSchema>

export async function createIdentity(extractable = false): Promise<Identity> {
    const [signing, encryption] = await Promise.all([
        generateKeyPair("ES256", { extractable }),
        generateKeyPair("RSA-OAEP-256", { modulusLength: 2048, extractable })
    ])
    return { signing, encryption }
}

export async function publicKeys(
    identity: Identity,
    keyId: string
): Promise<ServerPublicKeys> {
    const signing = await exportJWK(identity.signing.publicKey)
    const encryption = await exportJWK(identity.encryption.publicKey)
    return serverKeysSchema.parse({
        version: 1,
        keyId,
        signingKey: {
            kty: signing.kty,
            crv: signing.crv,
            x: signing.x,
            y: signing.y
        },
        encryptionKey: { kty: encryption.kty, n: encryption.n, e: encryption.e }
    })
}

export async function seal(
    payload: unknown,
    signingKey: CryptoKey,
    encryptionKey: CryptoKey,
    signerId: string,
    recipientId: string
): Promise<string> {
    const signed = await new CompactSign(
        encoder.encode(JSON.stringify(payload))
    )
        .setProtectedHeader({ alg: "ES256", typ: "mewcat+jws", kid: signerId })
        .sign(signingKey)
    return new CompactEncrypt(encoder.encode(signed))
        .setProtectedHeader({
            alg: "RSA-OAEP-256",
            enc: "A256GCM",
            typ: "mewcat+jwe",
            cty: "mewcat+jws",
            kid: recipientId
        })
        .encrypt(encryptionKey)
}

export async function decryptEnvelope(
    wire: string,
    key: CryptoKey,
    recipientId: string
): Promise<string> {
    const { plaintext, protectedHeader } = await compactDecrypt(wire, key, {
        keyManagementAlgorithms: ["RSA-OAEP-256"],
        contentEncryptionAlgorithms: ["A256GCM"]
    })
    if (
        protectedHeader.kid !== recipientId ||
        protectedHeader.typ !== "mewcat+jwe" ||
        protectedHeader.cty !== "mewcat+jws"
    ) {
        throw new Error("Invalid encryption header")
    }
    return decoder.decode(plaintext)
}

// 仅用于查找验签公钥；返回的数据在 verifySigned 成功前绝不可信。
export function readSigned(signed: string): {
    signerId: string
    payload: unknown
} {
    const header = decodeProtectedHeader(signed)
    const parts = signed.split(".")
    if (
        parts.length !== 3 ||
        header.alg !== "ES256" ||
        header.typ !== "mewcat+jws" ||
        typeof header.kid !== "string" ||
        header.kid.length > 100
    ) {
        throw new Error("Invalid signature header")
    }
    return {
        signerId: header.kid,
        payload: JSON.parse(
            decoder.decode(base64url.decode(parts[1]!))
        ) as unknown
    }
}

export async function verifySigned(
    signed: string,
    key: CryptoKey,
    signerId: string
): Promise<unknown> {
    const { payload, protectedHeader } = await compactVerify(signed, key, {
        algorithms: ["ES256"]
    })
    if (
        protectedHeader.typ !== "mewcat+jws" ||
        protectedHeader.kid !== signerId
    )
        throw new Error("Invalid signature header")
    return JSON.parse(decoder.decode(payload)) as unknown
}

export async function open(
    wire: string,
    decryptionKey: CryptoKey,
    verificationKey: CryptoKey,
    signerId: string,
    recipientId: string
): Promise<unknown> {
    return verifySigned(
        await decryptEnvelope(wire, decryptionKey, recipientId),
        verificationKey,
        signerId
    )
}

export function validateRequest(
    payload: unknown,
    path: string,
    now: number,
    skewMs: number
): SignedRequest {
    const request = requestSchema.parse(payload)
    if (request.path !== path || Math.abs(now - request.timestamp) > skewMs)
        throw new Error("Expired or misbound request")
    return request
}

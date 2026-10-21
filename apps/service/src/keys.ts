import { readFile } from "node:fs/promises"
import {
    encryptionPublicKeySchema,
    publicKeys,
    signingPublicKeySchema,
    type Identity,
    type ServerPublicKeys
} from "@mewcat/protocol"
import { exportJWK, importJWK } from "jose"
import { z } from "zod"

export interface ServerKeys {
    identity: Identity
    publicKeys: ServerPublicKeys
    ipHashSecret: string
}
const keyFileSchema = z.strictObject({
    version: z.literal(1),
    keyId: z.string().min(1).max(100),
    ipHashSecret: z.string().min(43),
    signingPrivateKey: z.record(z.string(), z.unknown()),
    encryptionPrivateKey: z.record(z.string(), z.unknown())
})
export async function serializeKeys(
    identity: Identity,
    keyId: string,
    ipHashSecret: string
) {
    return {
        version: 1,
        keyId,
        ipHashSecret,
        signingPrivateKey: await exportJWK(identity.signing.privateKey),
        encryptionPrivateKey: await exportJWK(identity.encryption.privateKey)
    }
}
export async function loadKeys(path: string): Promise<ServerKeys> {
    const file = keyFileSchema.parse(JSON.parse(await readFile(path, "utf8")))
    if (
        typeof file.signingPrivateKey.d !== "string" ||
        typeof file.encryptionPrivateKey.d !== "string"
    )
        throw new Error("密钥文件必须包含私钥")
    const s = file.signingPrivateKey
    const e = file.encryptionPrivateKey
    const signingPublic = signingPublicKeySchema.parse({
        kty: s.kty,
        crv: s.crv,
        x: s.x,
        y: s.y
    })
    const encryptionPublic = encryptionPublicKeySchema.parse({
        kty: e.kty,
        n: e.n,
        e: e.e
    })
    const identity: Identity = {
        signing: {
            publicKey: (await importJWK(signingPublic, "ES256")) as CryptoKey,
            privateKey: (await importJWK(
                file.signingPrivateKey,
                "ES256"
            )) as CryptoKey
        },
        encryption: {
            publicKey: (await importJWK(
                encryptionPublic,
                "RSA-OAEP-256"
            )) as CryptoKey,
            privateKey: (await importJWK(
                file.encryptionPrivateKey,
                "RSA-OAEP-256"
            )) as CryptoKey
        }
    }
    return {
        identity,
        publicKeys: await publicKeys(identity, file.keyId),
        ipHashSecret: file.ipHashSecret
    }
}

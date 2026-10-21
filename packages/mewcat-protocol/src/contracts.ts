import { z } from "zod"

import {
    encryptionPublicKeySchema,
    signingPublicKeySchema
} from "./protocol.js"

const language = z
    .string()
    .min(2)
    .max(35)
    .regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/)
export const translationSchema = z
    .strictObject({
        texts: z
            .array(
                z
                    .string()
                    .min(1)
                    .max(5000)
                    .refine(value => value.trim().length > 0)
            )
            .min(1)
            .max(20),
        sourceLanguage: z.union([z.literal("auto"), language]).default("auto"),
        targetLanguage: language.refine(value => value.toLowerCase() !== "auto")
    })
    .refine(
        data =>
            data.texts.reduce((total, text) => total + text.length, 0) <= 5000,
        "Total text length exceeds 5000"
    )
export type TranslationInput = z.infer<typeof translationSchema>
export const registrationSchema = z.strictObject({
    name: z.string().trim().min(1).max(80),
    signingKey: signingPublicKeySchema,
    encryptionKey: encryptionPublicKeySchema
})
export const translationResultSchema = z.strictObject({
    translations: z.array(z.string().min(1).max(40_000)).min(1).max(20)
})
export const usageSchema = z.strictObject({
    usedCharacters: z.number().int().nonnegative(),
    limitCharacters: z.number().int().positive(),
    resetsAt: z.string().datetime()
})

export const feedbackSchema = z.strictObject({
    message: z.string().trim().min(5).max(5000),
    replyEmail: z.string().trim().max(254).email().optional(),
    extensionVersion: z
        .string()
        .max(32)
        .regex(/^\d+(?:\.\d+){0,3}$/)
})
export type FeedbackInput = z.infer<typeof feedbackSchema>
export const feedbackResultSchema = z.strictObject({
    accepted: z.literal(true)
})

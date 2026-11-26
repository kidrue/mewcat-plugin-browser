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
        targetLanguage: language.refine(
            value => value.toLowerCase() !== "auto"
        ),
        context: z.string().trim().min(1).max(2000).optional()
    })
    .refine(
        data =>
            data.texts.reduce((total, text) => total + text.length, 0) <= 5000,
        "Total text length exceeds 5000"
    )
export type TranslationInput = z.infer<typeof translationSchema>

export const CHAT_COMPLETIONS_PATH = "/v1/chat/completions"
export const CHAT_COMPLETIONS_MAX_INPUT = 16_000
// JWS and then JWE both add base64url overhead. Leave room for both headers and device identifiers.
const CHAT_COMPLETIONS_MAX_JSON_BYTES = 54_000
const stopSequence = z.string().min(1).max(128)
export const chatCompletionInputSchema = z
    .strictObject({
        messages: z
            .array(
                z.strictObject({
                    role: z.enum(["system", "user", "assistant"]),
                    content: z.string().min(1).max(CHAT_COMPLETIONS_MAX_INPUT)
                })
            )
            .min(1)
            .max(20),
        temperature: z.number().min(0).max(2).optional(),
        top_p: z.number().gt(0).max(1).optional(),
        max_tokens: z.number().int().min(1).max(8192).optional(),
        stop: z
            .union([stopSequence, z.array(stopSequence).min(1).max(4)])
            .optional(),
        stream: z.literal(false).optional(),
        response_format: z
            .strictObject({ type: z.enum(["text", "json_object"]) })
            .optional()
    })
    .refine(
        input =>
            input.messages.reduce(
                (sum, message) => sum + message.content.length,
                0
            ) <= CHAT_COMPLETIONS_MAX_INPUT,
        "Total message length exceeds 16000"
    )
    .refine(
        input =>
            new TextEncoder().encode(JSON.stringify(input)).length <=
            CHAT_COMPLETIONS_MAX_JSON_BYTES,
        "Serialized request exceeds 54000 bytes"
    )
export type ChatCompletionInput = z.infer<typeof chatCompletionInputSchema>

export const chatCompletionResultSchema = z.strictObject({
    choices: z.tuple([
        z.strictObject({
            index: z.literal(0),
            message: z.strictObject({
                role: z.literal("assistant"),
                content: z.string().max(64_000)
            }),
            finish_reason: z.enum(["stop", "length", "content_filter"])
        })
    ]),
    usage: z
        .strictObject({
            prompt_tokens: z.number().int().nonnegative(),
            completion_tokens: z.number().int().nonnegative(),
            total_tokens: z.number().int().nonnegative()
        })
        .optional()
})
export type ChatCompletionResult = z.infer<typeof chatCompletionResultSchema>

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
export const USAGE_DETAILS_PATH = "/v1/usage/details"
export const usageDetailsSchema = usageSchema.extend({
    ipLimitCharacters: z.number().int().positive()
})
export type UsageDetails = z.infer<typeof usageDetailsSchema>

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

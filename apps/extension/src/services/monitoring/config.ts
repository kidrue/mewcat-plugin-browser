import type { RuntimeConfigInput } from "./types"

export function createSentryRuntimeConfig(input: RuntimeConfigInput) {
    return {
        enabled: input.isProduction && input.dsn.trim().length > 0,
        dsn: input.dsn.trim(),
        environment: "production",
        release: `mewcat@${input.version}`,
        sendDefaultPii: false,
        sampleRate: 1,
        tracesSampleRate: 0,
        replaysSessionSampleRate: input.enableReplay ? 0 : undefined,
        replaysOnErrorSampleRate: input.enableReplay ? 1 : undefined,
        tags: {
            runtime_context: input.runtimeContext,
            extension_version: input.version
        }
    }
}

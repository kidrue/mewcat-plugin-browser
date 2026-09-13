import { captureExtensionException } from "@/monitoring"

export async function monitorBackgroundHandler<T>(
    operation: string,
    handler: () => Promise<T> | T,
    pageUrl?: string
): Promise<T> {
    try {
        return await handler()
    } catch (error) {
        captureExtensionException(error, {
            feature: "background-message",
            operation,
            pageUrl
        })
        throw error
    }
}

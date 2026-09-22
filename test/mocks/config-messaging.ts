import type { ConfigUpdateRequest } from "../../src/messaging/protocol"

// Replace only the browser transport; exercise the real background writer.
export async function sendMessage(name: string, request: ConfigUpdateRequest) {
    if (name !== "update-config") throw new Error(`Unexpected message: ${name}`)
    const { handleUpdateConfig } = await import(
        "../../src/background/messages/update-config"
    )
    return handleUpdateConfig(structuredClone(request))
}

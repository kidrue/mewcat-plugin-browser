/** Normalize SSE framing for xsAI 0.4, including split UTF-8 and CRLF. */
export function normalizeModelStreamResponse(response: Response): Response {
    if (!response.ok || !response.body) return response
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    let buffer = ""
    const emitLines = (
        controller: TransformStreamDefaultController<Uint8Array>
    ) => {
        let separator: RegExpExecArray | null
        // Keep a trailing CR until the next chunk so a split CRLF stays one newline.
        while ((separator = /\r\n|\n|\r(?!$)/.exec(buffer))) {
            const line = buffer.slice(0, separator.index)
            buffer = buffer.slice(separator.index + separator[0].length)
            if (/^data:\s*\[DONE\]\s*$/.test(line)) {
                controller.enqueue(encoder.encode("data: [DONE]\n"))
                controller.terminate()
                return
            }
            controller.enqueue(encoder.encode(`${line}\n`))
        }
    }
    const body = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                buffer += decoder.decode(chunk, { stream: true })
                emitLines(controller)
            },
            flush(controller) {
                buffer += `${decoder.decode()}\n`
                emitLines(controller)
            }
        })
    )
    const headers = new Headers(response.headers)
    headers.delete("content-length")
    headers.delete("content-encoding")
    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers
    })
}

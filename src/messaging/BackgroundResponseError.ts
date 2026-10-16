/** A business failure whose reporting policy belongs to the background handler. */
export class BackgroundResponseError extends Error {
    constructor(
        readonly code: string,
        message: string
    ) {
        super(message)
        this.name = "BackgroundResponseError"
    }
}

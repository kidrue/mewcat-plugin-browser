// Keep original exceptions within the worker; never add them to serialized responses.
const failureCauses = new WeakMap<object, unknown>()

export function withFailureCause<T extends object>(
    response: T,
    error: unknown
): T {
    failureCauses.set(response, error)
    return response
}

export function getFailureCause(response: object): unknown {
    return failureCauses.get(response)
}

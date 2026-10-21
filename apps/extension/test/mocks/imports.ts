export const storage = {
    getItem: async <T>(_key: string): Promise<T | undefined> => undefined,
    setItem: async (): Promise<void> => undefined,
    removeItem: async (): Promise<void> => undefined,
    watch: (): (() => void) => () => undefined
}

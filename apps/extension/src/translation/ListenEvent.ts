type ExtractOnEventNames<T extends object> = {
    [K in keyof T]: K extends `on${string}` ? K : never
}[keyof T]

export class ListenEvent<
    T extends Record<`on${string}`, (...args: unknown[]) => void>
> {
    // 事件监听器存储：键为事件类型，值为回调函数数组
    private eventListeners: { [key: string]: Array<(data: unknown) => void> } =
        {}

    /**
     * 添加事件监听
     * @param event 事件类型（如 'stateChange'）
     * @param callback 事件触发时的回调函数
     */
    public addEventListener(
        event: ExtractOnEventNames<T>,
        callback: T[ExtractOnEventNames<T>]
    ) {
        // 初始化事件对应的监听器数组（如果不存在）
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = []
        }
        // 避免重复添加相同回调
        if (!this.eventListeners[event].includes(callback)) {
            this.eventListeners[event].push(callback)
        }
    }

    /**
     * 移除事件监听
     * @param event 事件类型
     * @param callback 要移除的回调函数
     */
    public removeEventListener(
        event: ExtractOnEventNames<T>,
        fn: T[ExtractOnEventNames<T>]
    ) {
        if (this.eventListeners[event]) {
            // 过滤掉要移除的回调
            Reflect.deleteProperty(this.eventListeners.event, event)
        }
    }

    /**
     * 内部方法：触发事件（通知所有监听器）
     * @param event 事件类型
     * @param data 传递给监听器的数据（如状态变化详情）
     */
    public dispatchEvent(event: ExtractOnEventNames<T>, data: unknown) {
        if (this.eventListeners[event]) {
            // 遍历执行所有监听器，并传递数据
            this.eventListeners[event].forEach(callback => {
                callback(data)
            })
        }
    }
}

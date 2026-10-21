import { useCallback, useState } from "react"

// 自定义Hook用于管理展开状态
export const useCollapse = props => {
    const { open: controlledOpen, onChange } = props
    const isControlled = controlledOpen !== undefined
    const [internalOpen, setInternalOpen] = useState(controlledOpen || false)

    const open = isControlled ? controlledOpen : internalOpen

    const toggle = useCallback(() => {
        if (!isControlled) {
            setInternalOpen(prev => !prev)
        }
        if (onChange) {
            onChange(!open)
        }
    }, [isControlled, open, onChange])

    const setOpen = useCallback(
        value => {
            if (!isControlled) {
                setInternalOpen(value)
            }
            if (onChange) {
                onChange(value)
            }
        },
        [isControlled, onChange]
    )

    return { open, toggle, setOpen }
}

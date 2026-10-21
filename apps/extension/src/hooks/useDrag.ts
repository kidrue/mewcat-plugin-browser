import { useEffect, useRef, useState } from "react"

interface Position {
    x: number
    y: number
}

const BUTTON_SIZE = 54

export function dockPosition(
    position: Position,
    width: number,
    height: number
): Position {
    return {
        x:
            position.x + BUTTON_SIZE / 2 < width / 2
                ? 0
                : Math.max(0, width - BUTTON_SIZE),
        y: Math.max(
            Math.min(44, Math.max(0, (height - BUTTON_SIZE) / 2)),
            Math.min(position.y, height - BUTTON_SIZE - 44)
        )
    }
}

export const useDrag = () => {
    const [position, setPosition] = useState<Position>(() =>
        dockPosition(
            {
                x: window.innerWidth,
                y: window.innerHeight / 2 - BUTTON_SIZE / 2
            },
            window.innerWidth,
            window.innerHeight
        )
    )
    const [isDragging, setIsDragging] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const isDragged = useRef(false)
    const positionRef = useRef(position)
    positionRef.current = position

    useEffect(() => {
        const element = ref.current
        if (!element) {
            return
        }
        let viewportWidth = window.innerWidth
        let start: { mouse: Position; position: Position } | null = null
        const moveTo = (next: Position) => {
            positionRef.current = next
            setPosition(next)
        }
        const handleMouseDown = (event: MouseEvent) => {
            if (
                event.button !== 0 ||
                !(event.target instanceof Element) ||
                !event.target.closest("[data-mewcat-drag-handle]")
            ) {
                return
            }
            isDragged.current = false
            start = {
                mouse: { x: event.clientX, y: event.clientY },
                position: positionRef.current
            }
        }
        const handleMouseMove = (event: MouseEvent) => {
            if (!start) {
                return
            }
            const dx = event.clientX - start.mouse.x
            const dy = event.clientY - start.mouse.y
            if (!isDragged.current && Math.hypot(dx, dy) < 5) {
                return
            }
            isDragged.current = true
            setIsDragging(true)
            moveTo({
                x: Math.max(
                    0,
                    Math.min(
                        start.position.x + dx,
                        window.innerWidth - BUTTON_SIZE
                    )
                ),
                y: Math.max(
                    0,
                    Math.min(
                        start.position.y + dy,
                        window.innerHeight - BUTTON_SIZE
                    )
                )
            })
        }
        const handleMouseUp = () => {
            if (!start) {
                return
            }
            start = null
            setIsDragging(false)
            moveTo(
                dockPosition(
                    positionRef.current,
                    window.innerWidth,
                    window.innerHeight
                )
            )
        }
        const handleResize = () => {
            const right =
                positionRef.current.x + BUTTON_SIZE / 2 >= viewportWidth / 2
            viewportWidth = window.innerWidth
            moveTo(
                dockPosition(
                    { x: right ? viewportWidth : 0, y: positionRef.current.y },
                    window.innerWidth,
                    window.innerHeight
                )
            )
        }
        element.addEventListener("mousedown", handleMouseDown)
        document.addEventListener("mousemove", handleMouseMove)
        document.addEventListener("mouseup", handleMouseUp)
        window.addEventListener("blur", handleMouseUp)
        window.addEventListener("resize", handleResize)
        return () => {
            element.removeEventListener("mousedown", handleMouseDown)
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
            window.removeEventListener("blur", handleMouseUp)
            window.removeEventListener("resize", handleResize)
        }
    }, [])

    return { ref, position, isDragging, isDragged }
}

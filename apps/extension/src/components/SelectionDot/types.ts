export interface SelectionDotProps {
    x: number
    y: number
    onClick: () => void
    onMouseEnter?: () => void
    interactionMode: "click" | "hover"
    triggerMode?: "direct" | "dot" | "shift" | "ctrl"
}

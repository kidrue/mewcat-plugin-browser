/**
 * Validate whether an image element is eligible for translation.
 * @param element - Image or canvas element to validate
 * @returns Validation result with error message if invalid
 */
export function validateImage(element: HTMLImageElement | HTMLCanvasElement): {
    valid: boolean
    error?: string
} {
    if (element instanceof HTMLImageElement) {
        if (!element.complete || !element.naturalWidth) {
            return { valid: false, error: "图片未加载完成" }
        }

        if (element.naturalWidth < 50 || element.naturalHeight < 50) {
            return { valid: false, error: "图片尺寸过小" }
        }

        return { valid: true }
    }

    if (element.width < 50 || element.height < 50) {
        return { valid: false, error: "图片尺寸过小" }
    }

    return { valid: true }
}

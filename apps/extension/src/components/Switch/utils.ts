import { SIZES } from "./constants"
import type { SizeKey } from "./types"

export const sizeOf = (size: string) => SIZES[size as SizeKey] ?? SIZES.md

import {
    autoUpdate,
    flip,
    FloatingFocusManager,
    FloatingPortal,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole
} from "@floating-ui/react"
import React, { useCallback, useId, useRef, useState } from "react"

import { EMPTY_VALUES } from "./constants"
import {
    ArrowIcon,
    Checkbox,
    Dropdown,
    EmptyResult,
    Option,
    OptionList,
    SearchHeader,
    SearchInput,
    SelectButton,
    SelectContainer,
    SelectText
} from "./styles"
import type { SelectOption, SelectProps } from "./types"

export const Select: React.FC<SelectProps> = ({
    value,
    onChange,
    placement = "bottom-start",
    options,
    placeholder = "请选择",
    searchPlaceholder = "搜索选项",
    emptyMessage = "未找到匹配的选项",
    disabled = false,
    id,
    "aria-label": ariaLabel,
    withinPortal,
    multiple = false,
    renderTrigger,
    dropdownWidth
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")

    const containerRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLInputElement>(null)
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

    const listId = useId()
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
    const filteredOptions = options.filter(option =>
        `${option.value} ${option.label}`
            .toLocaleLowerCase()
            .includes(normalizedQuery)
    )
    const handleOpenChange = useCallback((open: boolean) => {
        setIsOpen(open)
        setSearchQuery("")
    }, [])

    const selectedOption = multiple
        ? null
        : options.find(option => option.value === value)
    const selectedValues =
        multiple && Array.isArray(value) ? value : EMPTY_VALUES

    const resolvedDropdownWidth =
        dropdownWidth ??
        containerRef.current?.getBoundingClientRect().width ??
        0

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen && !disabled,
        placement,
        transform: true,
        onOpenChange: handleOpenChange,
        whileElementsMounted: autoUpdate,
        middleware: [shift(), flip()]
    })

    const click = useClick(context, { enabled: !disabled })
    const role = useRole(context)
    const dismiss = useDismiss(context)
    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        role,
        dismiss
    ])

    const handleSelect = useCallback(
        (option: SelectOption) => {
            if (multiple) {
                const newValues = selectedValues.includes(option.value)
                    ? selectedValues.filter(v => v !== option.value)
                    : [...selectedValues, option.value]
                onChange(newValues as string[] | number[])
            } else {
                onChange(option.value)
                handleOpenChange(false)
            }
        },
        [handleOpenChange, multiple, onChange, selectedValues]
    )

    const triggerProps: React.ComponentPropsWithRef<"button"> = {
        type: "button",
        id,
        "aria-label": ariaLabel,
        disabled,
        ref: refs.setReference,
        ...getReferenceProps()
    }

    return (
        <SelectContainer ref={containerRef} $customTrigger={!!renderTrigger}>
            {renderTrigger ? (
                renderTrigger(triggerProps)
            ) : (
                <SelectButton {...triggerProps}>
                    <SelectText>
                        {multiple
                            ? selectedValues.length > 0
                                ? `已选择 ${selectedValues.length} 项`
                                : placeholder
                            : selectedOption
                              ? selectedOption.label
                              : placeholder}
                    </SelectText>
                    <ArrowIcon $isOpen={isOpen && !disabled}>
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </ArrowIcon>
                </SelectButton>
            )}

            {isOpen && !disabled && (
                <FloatingPortal
                    root={withinPortal ? document.body : containerRef.current}
                >
                    <FloatingFocusManager
                        context={context}
                        initialFocus={searchRef}
                    >
                        <Dropdown
                            ref={refs.setFloating}
                            style={floatingStyles}
                            {...getFloatingProps()}
                            width={resolvedDropdownWidth}
                        >
                            <SearchHeader>
                                <SearchInput
                                    ref={searchRef}
                                    type="search"
                                    aria-label={searchPlaceholder}
                                    aria-controls={listId}
                                    placeholder={searchPlaceholder}
                                    value={searchQuery}
                                    onChange={event =>
                                        setSearchQuery(event.target.value)
                                    }
                                    onKeyDown={event => {
                                        if (event.nativeEvent.isComposing) {
                                            return
                                        }
                                        if (
                                            event.key === "ArrowDown" ||
                                            event.key === "ArrowUp"
                                        ) {
                                            event.preventDefault()
                                            optionRefs.current[
                                                event.key === "ArrowDown"
                                                    ? 0
                                                    : filteredOptions.length - 1
                                            ]?.focus()
                                        }
                                    }}
                                />
                            </SearchHeader>
                            <OptionList
                                id={listId}
                                role="listbox"
                                aria-label={ariaLabel ?? placeholder}
                                aria-multiselectable={multiple || undefined}
                            >
                                {filteredOptions.map((option, index) => {
                                    const isSelected = multiple
                                        ? selectedValues.includes(option.value)
                                        : option.value === value
                                    return (
                                        <Option
                                            key={String(option.value)}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            $isSelected={isSelected}
                                            ref={node => {
                                                optionRefs.current[index] = node
                                            }}
                                            onClick={() => handleSelect(option)}
                                            onKeyDown={event => {
                                                if (
                                                    event.key === "ArrowDown" ||
                                                    event.key === "ArrowUp"
                                                ) {
                                                    event.preventDefault()
                                                    const nextIndex =
                                                        index +
                                                        (event.key ===
                                                        "ArrowDown"
                                                            ? 1
                                                            : -1)
                                                    if (
                                                        nextIndex < 0 ||
                                                        nextIndex >=
                                                            filteredOptions.length
                                                    ) {
                                                        searchRef.current?.focus()
                                                    } else {
                                                        optionRefs.current[
                                                            nextIndex
                                                        ]?.focus()
                                                    }
                                                }
                                            }}
                                        >
                                            {multiple && (
                                                <Checkbox
                                                    $checked={isSelected}
                                                    aria-hidden="true"
                                                >
                                                    {isSelected ? "✓" : ""}
                                                </Checkbox>
                                            )}
                                            {option.label}
                                        </Option>
                                    )
                                })}
                            </OptionList>
                            {filteredOptions.length === 0 && (
                                <EmptyResult role="status">
                                    {emptyMessage}
                                </EmptyResult>
                            )}
                        </Dropdown>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </SelectContainer>
    )
}

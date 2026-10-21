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
    useRole,
    type Placement
} from "@floating-ui/react"
import React, { useId, useRef, useState } from "react"
import styled from "styled-components"

import { hideScrollBar } from "../../styles/scroll"

interface Option {
    value: string | number
    label: string
}

interface SelectProps {
    value: string | number | string[] | number[]
    options: Option[]
    placeholder?: string
    searchPlaceholder?: string
    emptyMessage?: string
    disabled?: boolean
    id?: string
    "aria-label"?: string
    multiple?: boolean
    withinPortal?: boolean
    placement?: Placement
    onChange: (value: string | number | string[] | number[]) => void
}

const SelectContainer = styled.div`
    position: relative;
    width: 100%;
`

const SelectButton = styled.button`
    width: 100%;
    height: 36px;
    padding: 0 var(--space-3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);

    &:hover {
        border-color: var(--gray-400);
    }

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px var(--seal-ring);
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`

const SelectText = styled.span`
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`

const ArrowIcon = styled.span<{ $isOpen: boolean }>`
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: var(--space-2);
    transition: transform var(--transition-fast);
    transform: ${props => (props.$isOpen ? "rotate(180deg)" : "rotate(0deg)")};
    color: var(--text-tertiary);

    svg {
        width: 14px;
        height: 14px;
    }
`

const Dropdown = styled.div<{ width: number }>`
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
    border-radius: var(--radius-lg);
    z-index: var(--z-dropdown);
    width: ${({ width }) => width}px;
    max-height: 300px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`

const SearchHeader = styled.div`
    flex-shrink: 0;
    padding: var(--space-2);
    border-bottom: 1px solid var(--border-color);
`

const SearchInput = styled.input`
    box-sizing: border-box;
    width: 100%;
    height: 32px;
    padding: 0 var(--space-2);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px var(--seal-ring);
    }
`

const OptionList = styled.div`
    min-height: 0;
    overflow-y: auto;
    ${hideScrollBar}
`

const EmptyResult = styled.div`
    padding: var(--space-3);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
`

const Option = styled.button<{ $isSelected: boolean }>`
    width: 100%;
    border: 0;
    text-align: left;
    font-family: inherit;
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: ${props =>
        props.$isSelected ? "var(--primary-color)" : "var(--text-primary)"};
    background: ${props =>
        props.$isSelected ? "var(--seal-wash)" : "transparent"};
    /* 选中不只靠颜色：左侧压一道朱砂 */
    box-shadow: ${props =>
        props.$isSelected ? "inset 3px 0 0 var(--primary-color)" : "none"};
    display: flex;
    align-items: center;
    gap: var(--space-2);
    transition: background var(--transition-fast);

    &:hover,
    &:focus-visible {
        background: ${props =>
            props.$isSelected ? "var(--seal-wash)" : "var(--bg-tertiary)"};
    }
`

const Checkbox = styled.span<{ $checked: boolean }>`
    width: 14px;
    height: 14px;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
    border: 1px solid var(--border-color);
    background: ${props =>
        props.$checked ? "var(--primary-color)" : "transparent"};
    color: white;
    display: inline-flex;
    align-items: center;
    justify-content: center;
`

const Select: React.FC<SelectProps> = ({
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
    multiple = false
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
    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)
        setSearchQuery("")
    }

    const selectedOption = multiple
        ? null
        : options.find(option => option.value === value)
    const selectedValues: (string | number)[] = multiple
        ? Array.isArray(value)
            ? value
            : []
        : []

    const dropDownWidth =
        containerRef.current?.getBoundingClientRect().width ?? 0

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

    const handleSelect = (option: Option) => {
        if (multiple) {
            const newValues = selectedValues.includes(option.value)
                ? selectedValues.filter(v => v !== option.value)
                : [...selectedValues, option.value]
            onChange(newValues as string[] | number[])
        } else {
            onChange(option.value)
            handleOpenChange(false)
        }
    }

    return (
        <SelectContainer ref={containerRef}>
            <SelectButton
                type="button"
                id={id}
                aria-label={ariaLabel}
                disabled={disabled}
                ref={refs.setReference}
                {...getReferenceProps()}
            >
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
                            width={dropDownWidth}
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

export default Select

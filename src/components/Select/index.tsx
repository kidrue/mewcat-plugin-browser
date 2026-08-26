import {
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
import React, { useRef, useState } from "react"
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
`

const SelectText = styled.span`
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`

const ArrowIcon = styled.span<{ isOpen: boolean }>`
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: var(--space-2);
    transition: transform var(--transition-fast);
    transform: ${props => (props.isOpen ? "rotate(180deg)" : "rotate(0deg)")};
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
    overflow-y: auto;
    ${hideScrollBar}
`

const Option = styled.div<{ isSelected: boolean }>`
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: ${props =>
        props.isSelected ? "var(--primary-color)" : "var(--text-primary)"};
    background: ${props =>
        props.isSelected ? "var(--seal-wash)" : "transparent"};
    /* 选中不只靠颜色：左侧压一道朱砂 */
    box-shadow: ${props =>
        props.isSelected ? "inset 3px 0 0 var(--primary-color)" : "none"};
    display: flex;
    align-items: center;
    gap: var(--space-2);
    transition: background var(--transition-fast);

    &:hover {
        background: ${props =>
            props.isSelected ? "var(--seal-wash)" : "var(--bg-tertiary)"};
    }
`

const Checkbox = styled.input`
    width: 14px;
    height: 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    accent-color: var(--primary-color);
`

const Select: React.FC<SelectProps> = ({
    value,
    onChange,
    placement = "bottom-start",
    options,
    placeholder = "请选择",
    withinPortal,
    multiple = false
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedOption = multiple
        ? null
        : options.find(option => option.value === value)
    const selectedValues = multiple ? (Array.isArray(value) ? value : []) : []

    const dropDownWidth =
        containerRef.current?.getBoundingClientRect().width ?? 0

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        placement,
        transform: true,
        onOpenChange: setIsOpen,
        middleware: [shift(), flip()]
    })

    const click = useClick(context)
    const role = useRole(context)
    const dismiss = useDismiss(context)

    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        role,
        dismiss
    ])

    const handleToggle = () => {
        setIsOpen(!isOpen)
    }

    const handleSelect = (option: Option) => {
        if (multiple) {
            const currentValues = Array.isArray(value)
                ? (value as (string | number)[])
                : []
            const newValues = currentValues.includes(option.value)
                ? currentValues.filter(v => v !== option.value)
                : [...currentValues, option.value]
            onChange(newValues as string[] | number[])
        } else {
            onChange(option.value)
            setIsOpen(false)
        }
    }

    return (
        <SelectContainer ref={containerRef}>
            <SelectButton
                onClick={handleToggle}
                ref={refs.setReference}
                {...getReferenceProps}
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
                <ArrowIcon isOpen={isOpen}>
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

            <FloatingFocusManager context={context}>
                {isOpen && (
                    <FloatingPortal
                        root={
                            withinPortal ? document.body : containerRef.current
                        }
                    >
                        <Dropdown
                            ref={refs.setFloating}
                            style={floatingStyles}
                            {...getFloatingProps}
                            width={dropDownWidth}
                        >
                            {options.map(option => {
                                const optionValue = option.value
                                const currentValue = multiple
                                    ? (selectedValues as (string | number)[])
                                    : value
                                const isSelected = multiple
                                    ? (
                                          currentValue as (string | number)[]
                                      ).includes(optionValue)
                                    : optionValue === currentValue
                                return (
                                    <Option
                                        key={String(option.value)}
                                        isSelected={isSelected}
                                        onClick={() => handleSelect(option)}
                                    >
                                        {multiple && (
                                            <Checkbox
                                                type="checkbox"
                                                checked={isSelected}
                                                readOnly
                                            />
                                        )}
                                        {option.label}
                                    </Option>
                                )
                            })}
                        </Dropdown>
                    </FloatingPortal>
                )}
            </FloatingFocusManager>
        </SelectContainer>
    )
}

export default Select

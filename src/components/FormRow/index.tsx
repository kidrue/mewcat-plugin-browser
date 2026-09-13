import React from "react"
import styled, { css } from "styled-components"

import type { FormRowProps } from "./types"

// 卡片内的字段用细线分隔；空间不足时控件换行，避免双列卡片挤压输入区。
const Row = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--space-6);
    padding: var(--space-4) 0;
    border-top: 1px solid var(--border-light);

    &:first-child {
        border-top: none;
        padding-top: 0;
    }

    &:last-child {
        padding-bottom: 0;
    }

    @media (max-width: 900px) {
        flex-direction: column;
        gap: var(--space-2);
    }
`

const Term = styled.div`
    flex: 0 0 208px;
    padding-top: 2px;

    @media (max-width: 900px) {
        flex: none;
        padding-top: 0;
    }
`

const Label = styled.label<{ $required: boolean }>`
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);

    ${({ $required }) =>
        $required &&
        css`
            &::after {
                content: "*";
                margin-left: var(--space-1);
                color: var(--primary-color);
                font-size: var(--font-size-xs);
            }
        `}
`

const Description = styled.p`
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    margin: var(--space-1) 0 0 0;
    line-height: var(--line-height-normal);
`

const Field = styled.div`
    flex: 1 1 220px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);

    @media (max-width: 900px) {
        flex: none;
        width: 100%;
    }
`

const FormRowComponent: React.FC<FormRowProps> = ({
    label,
    description,
    required,
    controlId,
    children,
    className,
    style
}) => {
    return (
        <Row className={className} style={style}>
            <Term>
                <Label $required={!!required} htmlFor={controlId}>
                    {label}
                </Label>
                {description && (
                    <Description
                        id={controlId ? `${controlId}-description` : undefined}
                    >
                        {description}
                    </Description>
                )}
            </Term>
            <Field>{children}</Field>
        </Row>
    )
}

FormRowComponent.displayName = "FormRow"

export default FormRowComponent

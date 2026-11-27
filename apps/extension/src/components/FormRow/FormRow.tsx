import React from "react"

import { CompactRow, Description, Field, Label, Row, Term } from "./styles"
import type { FormRowProps } from "./types"

export const FormRow: React.FC<FormRowProps> = ({
    label,
    description,
    compact,
    required,
    controlId,
    children,
    className,
    style
}) => {
    const Layout = compact ? CompactRow : Row
    return (
        <Layout className={className} style={style}>
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
        </Layout>
    )
}

FormRow.displayName = "FormRow"

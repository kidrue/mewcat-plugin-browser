import React from "react"

import {
    Description,
    Heading,
    HeadingIcon,
    RightSection,
    Section,
    SectionContent,
    SectionHeader,
    SectionTitle
} from "./styles"
import type { OptionsSectionProps } from "./types"

export const OptionsSection: React.FC<OptionsSectionProps> = ({
    title,
    description,
    artwork,
    icon,
    rightSection,
    layout = "default",
    children,
    className
}) => {
    const titleId = React.useId()
    return (
        <Section
            className={className}
            aria-labelledby={titleId}
            $artwork={artwork}
        >
            <SectionHeader>
                {icon && <HeadingIcon kind={icon} />}
                <Heading>
                    <SectionTitle id={titleId}>{title}</SectionTitle>
                    {description && <Description>{description}</Description>}
                </Heading>
                {rightSection && <RightSection>{rightSection}</RightSection>}
            </SectionHeader>
            <SectionContent layout={layout}>{children}</SectionContent>
        </Section>
    )
}

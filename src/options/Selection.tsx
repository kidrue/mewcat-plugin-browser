import { useAtom, useSetAtom } from "jotai"
import * as React from "react"

import {
    CustomSelect,
    FormRow,
    NativeSelect,
    OptionsSection,
    Switch
} from "@/components"
import {
    OptionsCardGrid,
    OptionsPageIntro
} from "@/components/OptionsPageLayout"
import {
    DISABLED_SITES_OPTIONS,
    INTERACTION_MODE_OPTIONS,
    TRIGGER_MODE_OPTIONS
} from "@/constants"
import { configAtom, updateConfigAtom } from "@/state"

export const Selection: React.FunctionComponent = () => {
    const [config] = useAtom(configAtom)
    const updateConfig = useSetAtom(updateConfigAtom)

    return (
        <>
            <OptionsPageIntro
                scene="desk"
                icon="book"
                title="划词翻译"
                description="选中一句话，从这里开始理解。按你的阅读习惯设置触发方式与使用范围。"
            />
            <OptionsSection
                artwork="coast"
                icon="mail"
                title="划词翻译设置"
                description="控制网页上选中文本后的翻译入口。"
            >
                <FormRow
                    label="启用划词翻译"
                    description="选中文本时显示翻译选项"
                    controlId="enable-selection-translation"
                >
                    <Switch
                        id="enable-selection-translation"
                        aria-describedby="enable-selection-translation-description"
                        checked={config.isSelectedTranslate || false}
                        onChange={checked =>
                            updateConfig({ isSelectedTranslate: checked })
                        }
                    />
                </FormRow>
            </OptionsSection>
            <OptionsCardGrid>
                <OptionsSection
                    artwork="desk"
                    icon="book"
                    title="触发与交互"
                    description="选择何时出现翻译入口，以及如何打开面板。"
                >
                    <FormRow
                        label="触发方式"
                        description="选择划词翻译的触发方式"
                        controlId="selection-trigger-mode"
                    >
                        <NativeSelect
                            id="selection-trigger-mode"
                            aria-describedby="selection-trigger-mode-description"
                            value={config.selectionTriggerMode || "direct"}
                            onChange={value =>
                                updateConfig({
                                    selectionTriggerMode: value as
                                        | "direct"
                                        | "dot"
                                        | "shift"
                                        | "ctrl"
                                })
                            }
                            options={TRIGGER_MODE_OPTIONS}
                            placeholder="选择触发方式"
                        />
                    </FormRow>

                    <FormRow
                        label="交互方式"
                        description="选择如何激活翻译面板"
                        controlId="selection-interaction-mode"
                    >
                        <NativeSelect
                            id="selection-interaction-mode"
                            aria-describedby="selection-interaction-mode-description"
                            value={config.selectionInteractionMode || "click"}
                            onChange={value =>
                                updateConfig({
                                    selectionInteractionMode: value as
                                        | "click"
                                        | "hover"
                                })
                            }
                            options={INTERACTION_MODE_OPTIONS}
                            placeholder="选择交互方式"
                        />
                    </FormRow>
                </OptionsSection>
                <OptionsSection
                    artwork="garden"
                    title="网站范围"
                    description="为需要保持原样的网站设置例外。"
                >
                    <FormRow
                        label="禁用网站"
                        description="在这些网站上不启用划词翻译"
                    >
                        <CustomSelect
                            value={config.selectionDisabledSites || []}
                            onChange={value =>
                                updateConfig({
                                    selectionDisabledSites: value as string[]
                                })
                            }
                            options={DISABLED_SITES_OPTIONS}
                            placeholder="选择禁用划词翻译的网站"
                            withinPortal
                            multiple
                        />
                    </FormRow>
                </OptionsSection>
            </OptionsCardGrid>
        </>
    )
}

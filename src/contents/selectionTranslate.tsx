import { useAtom } from "jotai"

import "react"

import styled, { StyleSheetManager } from "styled-components"

import "@/styles/theme.scss"

import Icon from "../components/Icon"
import SelectionDot from "../components/SelectionDot"
import { TranslateTextPanel } from "../components/TranslateTextPanel"

import "../constants"

import { useMemo } from "react"

import { INTERACTION_MODE_OPTIONS, TRIGGER_MODE_OPTIONS } from "../constants"
import { useSelectionTranslate } from "../hooks/useSelectionTranslate"
import { configAtom } from "../state"
import { getSelectionPanelVisibility } from "../translation/selectionTranslation"

export const getShadowHostId = () => "mewcat-overlay-selection"

const rootId = "selectionRoot"

const SCxContainer = styled.div.withConfig({
    shouldForwardProp: prop => !(prop === "isVisible")
})<{ isVisible: boolean }>`
    position: fixed;
    width: min(338px, calc(100vw - 16px));
    min-height: 120px;
    /* max-height: 300px; */
    z-index: 99999;
    background: #fbf8f0;
    border-radius: var(--radius-xl);
    box-shadow: 0 10px 34px rgba(26, 23, 20, 0.16);
    border: 1px solid #d8d0be;
    opacity: ${props => (props.isVisible ? 1 : 0)};
    visibility: ${props => getSelectionPanelVisibility(props.isVisible)};
    transform: ${props =>
        props.isVisible
            ? "translateY(0) scale(1)"
            : "translateY(-8px) scale(0.95)"};
    /* transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); */
    overflow: hidden;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;

    /* 顶端一道朱砂封边 */
    &::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: #b23a2e;
        border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    }
`

const SCxHeader = styled.div`
    padding: 12px 16px 8px 16px;
    border-bottom: 1px solid #e4ddcd;
    display: flex;
    align-items: center;
    justify-content: space-between;
`

const SCxTitle = styled.div`
    font-size: 12px;
    font-weight: 600;
    color: #b23a2e;
    letter-spacing: 0.04em;
    display: flex;
    align-items: center;
    gap: 6px;

    .icon-translate {
        width: 18px;
        height: 18px;
        background: #b23a2e;
        border-radius: var(--radius-md);
        box-shadow: inset 0 0 0 1px rgba(251, 248, 240, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
    }
`

const SCxCloseButton = styled.button`
    width: 20px;
    height: 20px;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    color: #6e665c;
    font-size: 12px;
    transition: all 0.16s ease;

    &:hover {
        background: rgba(178, 58, 46, 0.09);
        color: #b23a2e;
    }
`

const SCxContent = styled.div``

const SelectionTranslate = () => {
    const [config] = useAtom(configAtom)

    const getRootElement = () =>
        (document.querySelector(`#${getShadowHostId()}`)?.shadowRoot ??
            undefined) as unknown as HTMLElement | undefined

    // 使用划词翻译 Hook
    const {
        state,
        dotRef,
        containerRef,
        actions,
        config: selectionConfig
    } = useSelectionTranslate<HTMLDivElement>({
        config
    })

    const triggerModelLabel = useMemo(
        () =>
            TRIGGER_MODE_OPTIONS.find(
                v => v.value === config.selectionTriggerMode
            )?.label,
        [config.selectionTriggerMode]
    )

    const interactionModeLabel = useMemo(
        () =>
            INTERACTION_MODE_OPTIONS.find(
                v => v.value === config.selectionInteractionMode
            )?.label,
        [config.selectionInteractionMode]
    )
    return (
        <StyleSheetManager target={getRootElement()}>
            <div id={rootId}>
                {/* 触发点组件 - dot模式或按键模式下显示 */}
                {state.isDotVisible && state.triggerDot && (
                    <SelectionDot
                        x={state.triggerDot.x}
                        y={state.triggerDot.y}
                        onClick={actions.onDotClick}
                        onMouseEnter={actions.onDotHover}
                        interactionMode={selectionConfig.interactionMode}
                        triggerMode={selectionConfig.triggerMode}
                        ref={dotRef}
                    />
                )}
                {/* 翻译面板 */}
                <SCxContainer
                    isVisible={state.isVisible && !!state.text}
                    style={{
                        top: state.position?.top || 0,
                        left: state.position?.left || 0,
                        opacity: state.isVisible ? 1 : 0,
                        pointerEvents: state.isVisible ? "auto" : "none"
                    }}
                    ref={containerRef}
                >
                    <SCxHeader>
                        <SCxTitle>
                            <div className="icon-translate">
                                <Icon
                                    name="translate"
                                    size={12}
                                    color="white"
                                />
                            </div>
                            划词翻译
                            {/* 显示当前触发模式 */}
                            {selectionConfig.triggerMode !== "direct" && (
                                <span
                                    style={{
                                        fontSize: "10px",
                                        opacity: 0.7,
                                        marginLeft: "4px"
                                    }}
                                >
                                    ( {triggerModelLabel}-{interactionModeLabel}
                                    )
                                </span>
                            )}
                        </SCxTitle>
                        <SCxCloseButton onClick={actions.hideAll}>
                            <Icon name="close" size={12} />
                        </SCxCloseButton>
                    </SCxHeader>

                    <SCxContent>
                        <TranslateTextPanel
                            key={state.text}
                            data={state.text}
                            pageTitle={document.title}
                            context={state.context}
                            onFinished={actions.onComputeRect}
                        />
                    </SCxContent>
                </SCxContainer>
            </div>
        </StyleSheetManager>
    )
}

export default SelectionTranslate

import React, { useCallback, useEffect, useRef, useState } from "react"

import Icon from "../Icon"
import {
    Button,
    ButtonWrapper,
    Container,
    HelperText,
    Input,
    InputWrapper,
    StatusText
} from "./styles"
import type { ApiKeyInputProps } from "./types"

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
    id,
    label,
    value,
    onChange,
    disabledVisitable,
    disabled,
    placeholder = "请输入API Key",
    helperText,
    helperLink,
    onTest,
    testButtonText = "测试"
}) => {
    const [isVisible, setIsVisible] = useState(!!disabledVisitable)
    const [testStatus, setTestStatus] = useState<
        "idle" | "testing" | "success" | "error"
    >("idle")
    const [testMessage, setTestMessage] = useState("")

    const requestId = useRef(0)

    useEffect(() => {
        requestId.current += 1
        setTestStatus("idle")
        setTestMessage("")
        return () => {
            requestId.current += 1
        }
    }, [value])

    const hasValue = value.length > 0
    const isValid =
        testStatus === "success"
            ? true
            : testStatus === "error"
              ? false
              : undefined

    const handleToggleVisibility = useCallback(() => {
        setIsVisible(!isVisible)
    }, [isVisible])

    const handleTest = useCallback(async () => {
        if (!onTest || !hasValue || testStatus === "testing") {
            return
        }

        setTestStatus("testing")
        setTestMessage("正在测试连接...")
        const currentRequest = ++requestId.current

        try {
            const result = await onTest(value)
            if (currentRequest !== requestId.current) {
                return
            }
            if (result) {
                setTestStatus("success")
                setTestMessage("API Key 验证成功")
            } else {
                setTestStatus("error")
                setTestMessage("API Key 验证失败")
            }
        } catch (error) {
            if (currentRequest !== requestId.current) {
                return
            }
            setTestStatus("error")
            setTestMessage(
                `测试失败: ${error instanceof Error ? error.message : "未知错误"}`
            )
        }
    }, [hasValue, onTest, testStatus, value])

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value
            onChange(newValue)

            if (testStatus !== "idle") {
                setTestStatus("idle")
                setTestMessage("")
            }
        },
        [onChange, testStatus]
    )

    return (
        <Container>
            <InputWrapper>
                <Input
                    id={id}
                    aria-label={label}
                    type={isVisible ? "text" : "password"}
                    value={value}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    $isValid={isValid}
                    $actionCount={
                        Number(!!onTest && hasValue) +
                        Number(!!disabledVisitable && hasValue)
                    }
                />
                <ButtonWrapper>
                    {onTest && hasValue && (
                        <Button
                            $variant="test"
                            onClick={handleTest}
                            disabled={testStatus === "testing"}
                            title={
                                testStatus === "testing"
                                    ? "测试中..."
                                    : testButtonText
                            }
                        >
                            {testStatus === "testing" ? (
                                <Icon name="loading" size={12} />
                            ) : (
                                <Icon name="test" size={12} />
                            )}
                        </Button>
                    )}
                    {hasValue && disabledVisitable && (
                        <Button
                            $variant="toggle"
                            onClick={handleToggleVisibility}
                            title={isVisible ? "隐藏" : "显示"}
                        >
                            <Icon
                                name={isVisible ? "eye-off" : "eye"}
                                size={12}
                            />
                        </Button>
                    )}
                </ButtonWrapper>
            </InputWrapper>

            {testStatus !== "idle" && (
                <StatusText $status={testStatus}>
                    {testStatus === "testing" && (
                        <Icon name="loading" size={12} />
                    )}
                    {testStatus === "success" && (
                        <Icon name="success" size={12} />
                    )}
                    {testStatus === "error" && <Icon name="error" size={12} />}
                    {testMessage}
                </StatusText>
            )}

            <HelperText>
                {helperText}
                {helperLink && (
                    <a
                        href={helperLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {helperLink.text}
                    </a>
                )}
            </HelperText>
        </Container>
    )
}

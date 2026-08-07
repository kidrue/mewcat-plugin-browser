import React, { useState } from "react"
import styled from "styled-components"

import Icon from "../Icon"

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
`

const InputWrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
`

const Input = styled.input<{ $isValid?: boolean }>`
    width: 100%;
    padding: 0 var(--space-4);
    padding-right: 80px;
    height: 36px;
    border: 1px solid
        ${props => {
            if (props.$isValid === false) {
                return "var(--error)"
            }
            if (props.$isValid === true) {
                return "var(--success)"
            }
            return "var(--border-color)"
        }};
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: "Monaco", "Consolas", "Courier New", monospace;
    background: var(--bg-secondary);
    color: var(--text-primary);
    transition: all var(--transition-fast);

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px var(--seal-ring);
    }

    &::placeholder {
        color: var(--text-tertiary);
        font-family: var(--font-family);
    }

    &:disabled {
        background: var(--gray-100);
        color: var(--text-secondary);
        cursor: not-allowed;
    }
`

const ButtonWrapper = styled.div`
    position: absolute;
    right: var(--space-2);
    display: flex;
    gap: var(--space-1);
`

const Button = styled.button<{ $variant?: "test" | "toggle" }>`
    padding: var(--space-1) var(--space-2);
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;

    ${props =>
        props.$variant === "test"
            ? `
        background: var(--primary-color);
        color: var(--text-inverse);

        &:hover:not(:disabled) {
            background: var(--primary-hover);
        }

        &:disabled {
            background: var(--gray-300);
            cursor: not-allowed;
        }
    `
            : `
        background: var(--gray-100);
        color: var(--text-secondary);

        &:hover {
            background: var(--gray-200);
            color: var(--text-primary);
        }
    `}
`

const StatusText = styled.div<{ $status: "success" | "error" | "testing" }>`
    font-size: var(--font-size-xs);
    display: flex;
    align-items: center;
    gap: var(--space-1);

    ${props => {
        switch (props.$status) {
            case "success":
                return "color: var(--success);"
            case "error":
                return "color: var(--error);"
            case "testing":
                return "color: var(--primary-color);"
            default:
                return "color: var(--text-tertiary);"
        }
    }}
`

const HelperText = styled.div`
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    line-height: var(--line-height-normal);

    a {
        color: var(--primary-color);
        text-decoration: none;

        &:hover {
            text-decoration: underline;
        }
    }
`

interface ApiKeyInputProps {
    label: string
    value: string
    disabledVisitable?: boolean
    disabled?: boolean
    onChange: (value: string) => void
    placeholder?: string
    helperText?: string
    helperLink?: {
        text: string
        url: string
    }
    onTest?: (apiKey: string) => Promise<boolean>
    testButtonText?: string
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
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

    const hasValue = value.length > 0
    const isValid =
        testStatus === "success"
            ? true
            : testStatus === "error"
              ? false
              : undefined

    const handleToggleVisibility = () => {
        setIsVisible(!isVisible)
    }

    const handleTest = async () => {
        if (!onTest || !hasValue || testStatus === "testing") {
            return
        }

        setTestStatus("testing")
        setTestMessage("正在测试连接...")

        try {
            const result = await onTest(value)
            if (result) {
                setTestStatus("success")
                setTestMessage("API Key 验证成功")
            } else {
                setTestStatus("error")
                setTestMessage("API Key 验证失败")
            }
        } catch (error) {
            setTestStatus("error")
            setTestMessage(
                `测试失败: ${error instanceof Error ? error.message : "未知错误"}`
            )
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        onChange(newValue)

        if (testStatus !== "idle") {
            setTestStatus("idle")
            setTestMessage("")
        }
    }

    return (
        <Container>
            <InputWrapper>
                <Input
                    type={isVisible ? "text" : "password"}
                    value={value}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    $isValid={isValid}
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

export default ApiKeyInput

import styled from "styled-components"

export const Container = styled.div`
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
`

export const InputWrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
`

export const Input = styled.input<{ $isValid?: boolean; $actionCount: number }>`
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 0 var(--space-4);
    padding-right: ${props => {
        if (props.$actionCount > 1) return "80px"
        if (props.$actionCount === 1) return "44px"
        return "var(--space-4)"
    }};
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

export const ButtonWrapper = styled.div`
    position: absolute;
    right: var(--space-2);
    display: flex;
    gap: var(--space-1);
`

export const Button = styled.button<{ $variant?: "test" | "toggle" }>`
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

export const StatusText = styled.div<{
    $status: "success" | "error" | "testing"
}>`
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

export const HelperText = styled.div`
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

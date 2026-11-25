import { useAtom, useSetAtom } from "jotai"
import * as React from "react"
import styled from "styled-components"

import {
    Button,
    FormRow,
    InfoDisplay,
    OptionsSection,
    Switch,
    ToggleRow
} from "@/components"
import FeedbackButton from "@/components/FeedbackButton"
import GitHubIcon from "@/components/GitHubIcon"
import {
    OptionsCardGrid,
    OptionsPageIntro
} from "@/components/OptionsPageLayout"
import { SkyReadingPortrait } from "@/components/SkyArtwork"
import { EXTENSION_INFO } from "@/constants"
import { sendMessage } from "@/messaging"
import type {
    DeviceActivityRequest,
    DeviceActivityStatus
} from "@/messaging/protocol"
import { configAtom, updateConfigAtom } from "@/state"

import { AuthorAnalyticsEntry } from "./analytics/navigation"

const Page = styled.div`
    display: grid;
    gap: var(--space-6);

    > * {
        min-width: 0;
        margin-bottom: 0;
    }
`

const Details = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-5);

    > * {
        min-width: 0;
        margin-bottom: 0;
        overflow-wrap: anywhere;
    }

    @media (max-width: 560px) {
        grid-template-columns: 1fr;
    }
`

const RepositoryLink = styled.a`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-1);
    color: var(--primary-color);

    &:hover {
        color: var(--primary-hover);
    }

    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 4px;
        border-radius: var(--radius-sm);
    }
`

const InfoActions = styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin-top: var(--space-4);
`

const Note = styled.p`
    margin: var(--space-4) 0 0;
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-light);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-relaxed);
`

const ReadingFeatures = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) 172px;
    gap: var(--space-6);
    align-items: center;

    @media (max-width: 760px) {
        grid-template-columns: minmax(0, 1fr);
    }
`

const ReadingPortrait = styled(SkyReadingPortrait)`
    width: 172px;
    height: 200px;
    object-fit: cover;
    object-position: center 24%;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);

    @media (max-width: 760px) {
        display: none;
    }
`

const FeatureList = styled.dl`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-6);
    margin: 0;

    > div {
        min-width: 0;
    }

    > div + div {
        padding-left: var(--space-6);
        border-left: 1px solid var(--border-light);
    }

    dt {
        margin-bottom: var(--space-2);
        color: var(--text-primary);
        font-weight: var(--font-weight-semibold);
    }

    dd {
        margin: 0;
        color: var(--text-secondary);
        line-height: var(--line-height-relaxed);
        font-size: var(--font-size-sm);
    }

    @media (max-width: 760px) {
        grid-template-columns: 1fr;

        > div + div {
            padding-left: 0;
            padding-top: var(--space-5);
            border-left: 0;
            border-top: 1px solid var(--border-light);
        }
    }
`

type ActivitySettingRequest = Exclude<
    DeviceActivityRequest,
    { type: "page-translated" }
>

const activityStatusRequest = { type: "get-status" } as const

function DeviceActivitySection() {
    const controlId = React.useId()
    const [status, setStatus] = React.useState<DeviceActivityStatus | null>(
        null
    )
    const [pending, setPending] = React.useState(true)
    const [retry, setRetry] = React.useState<ActivitySettingRequest | null>(
        null
    )

    const update = React.useCallback(
        async (request: ActivitySettingRequest) => {
            setPending(true)
            try {
                const result = await sendMessage("device-activity", request)
                if (typeof result?.enabled !== "boolean") {
                    throw new Error("Missing activity status")
                }
                setStatus(result)
                setRetry(result.message ? request : null)
            } catch {
                setStatus(null)
                setRetry(request)
            } finally {
                setPending(false)
            }
        },
        []
    )

    React.useEffect(() => {
        void update(activityStatusRequest)
    }, [update])

    let statusText = status?.enabled ? "使用统计已开启。" : "使用统计已关闭。"
    if (!status) {
        statusText = "无法读取使用统计状态，请重试。"
    }
    if (status?.message) {
        statusText = status.message
    }
    if (pending) {
        statusText = "正在读取或更新使用统计…"
    }

    return (
        <OptionsSection title="使用统计" icon="ledger">
            <FormRow
                label="分享使用统计"
                controlId={controlId}
                description="服务器管理员可查看随机设备 ID、经授权的安装与确认卸载记录，以及翻译页数。网页地址仅在本地用于生成加盐的页面标识，单页统计明细最多保存 90 天。"
            >
                <Switch
                    id={controlId}
                    aria-describedby={`${controlId}-description`}
                    checked={status?.enabled ?? false}
                    disabled={pending || !status}
                    onChange={enabled =>
                        void update({ type: "set-enabled", enabled })
                    }
                />
                <div role="status">{statusText}</div>
                {retry && (
                    <Button
                        type="secondary"
                        size="sm"
                        disabled={pending}
                        onClick={() => void update(retry)}
                    >
                        重试
                    </Button>
                )}
            </FormRow>
            <Note>
                开启后，Chrome
                会在卸载时发送回执。关闭统计会停止上报并请求删除本设备的统计数据。
            </Note>
        </OptionsSection>
    )
}

export const About: React.FunctionComponent = () => {
    const [config] = useAtom(configAtom)
    const updateConfig = useSetAtom(updateConfigAtom)

    return (
        <Page>
            <OptionsPageIntro
                scene="coast"
                icon="mail"
                title="关于译趣喵"
                description={EXTENSION_INFO.description}
            />
            <OptionsCardGrid>
                <OptionsSection
                    artwork="coast"
                    icon="mail"
                    title="扩展信息"
                    description="mewCat · 译趣喵，让每一页文字更容易理解。"
                >
                    <Details>
                        <InfoDisplay
                            label="版本号"
                            value={EXTENSION_INFO.version}
                            type="version"
                        />
                        <div>
                            <p style={{ margin: "0 0 var(--space-2)" }}>作者</p>
                            <AuthorAnalyticsEntry
                                author={EXTENSION_INFO.author}
                            />
                        </div>
                    </Details>
                    <InfoActions>
                        <FeedbackButton />
                        <RepositoryLink
                            href={EXTENSION_INFO.repositoryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub 仓库"
                            title="在新标签页打开 GitHub 仓库"
                        >
                            <GitHubIcon />
                        </RepositoryLink>
                    </InfoActions>
                </OptionsSection>
                <OptionsSection
                    artwork="archive"
                    icon="ledger"
                    title="本地缓存"
                    description="把译文留在本地，让重复阅读更顺畅。"
                >
                    <ToggleRow
                        title="启用本地缓存"
                        description="缓存翻译结果以提高性能"
                        checked={config.cacheEnabled !== false}
                        onChange={checked =>
                            updateConfig({ cacheEnabled: checked })
                        }
                    />
                    <Note>再次遇到相同内容时，可优先使用已有译文。</Note>
                </OptionsSection>
            </OptionsCardGrid>
            <DeviceActivitySection />
            <OptionsSection
                title="陪你阅读的翻译工具"
                artwork="desk"
                icon="book"
            >
                <ReadingFeatures>
                    <FeatureList>
                        <div>
                            <dt>网页翻译</dt>
                            <dd>
                                在原网页中阅读译文，通过翻译服务设置选择语言与模型。
                            </dd>
                        </div>
                        <div>
                            <dt>划词翻译</dt>
                            <dd>选中需要理解的文字，按习惯设置触发方式。</dd>
                        </div>
                        <div>
                            <dt>图片翻译</dt>
                            <dd>
                                识别图片中的文字，使用配置的翻译服务阅读图片内容。
                            </dd>
                        </div>
                    </FeatureList>
                    <ReadingPortrait />
                </ReadingFeatures>
            </OptionsSection>
        </Page>
    )
}

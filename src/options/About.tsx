import { useAtom, useSetAtom } from "jotai"
import * as React from "react"
import styled from "styled-components"

import { InfoDisplay, OptionsSection, ToggleRow } from "@/components"
import {
    OptionsCardGrid,
    OptionsPageIntro
} from "@/components/OptionsPageLayout"
import { SkyReadingPortrait } from "@/components/SkyArtwork"
import { EXTENSION_INFO } from "@/constants"
import { configAtom, updateConfigAtom } from "@/state"

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
                        <InfoDisplay
                            label="作者"
                            value={EXTENSION_INFO.author}
                            type="strong"
                        />
                    </Details>
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

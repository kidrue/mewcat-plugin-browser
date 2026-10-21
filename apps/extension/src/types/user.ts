export interface BaseUser {
    username: string
    avatar: string
    wechat_bound: string
    register_time: string
    phone: string
    invite_code: string
}

export interface SubscriptionRemainingQuota {
    /**
     * @deprecated 已废弃，请使用 available_pages
     */
    parse_pages: string
    // 订阅过期时间
    subscription_end: string
    // 是否订阅
    subscribed: boolean
    // 订阅等级 1 免费 2 年度会员
    subscription_level: 1 | 2
    /**
     * @deprecated 已废弃，请使用 available_pages
     */
    image_quota: string
    /**
     * @deprecated 已废弃，请使用 available_pages
     */
    extra_image_quota: string
    // 可用积分
    available_points: string
    // 订阅持续时间
    subscription_duration: string
    // 共享解析额度
    available_pages: string
}

export interface FreeRemainingQuota {
    /**
     * @deprecated 已废弃，请使用 available_pages
     */
    parse_pages: string
    /**
     * @deprecated 已废弃，请使用 available_pages
     */
    image_quota: string
    // 共享解析额度
    available_pages: string
}

export interface User extends BaseUser {
    freeRemainQuota?: FreeRemainingQuota
    subscriptRemainQuota?: SubscriptionRemainingQuota
}

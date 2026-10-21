import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

import type { BaseUser } from "../types"
import { chromeStorageAdapter } from "./util"

// 默认用户数据
const defaultUser: BaseUser = {
    username: "",
    avatar: "",
    wechat_bound: "",
    register_time: "",
    phone: "",
    invite_code: ""
}

// 用户原子
export const userAtom = atom<BaseUser>(defaultUser)

export const accessTokenAtom = atomWithStorage<string>(
    "accessToken",
    null,
    chromeStorageAdapter,
    {
        getOnInit: true
    }
)

export const refreshTokenAtom = atomWithStorage<string>(
    "refreshToken",
    null,
    chromeStorageAdapter,
    {
        getOnInit: true
    }
)

// 设置用户数据的写入原子
export const setUserAtom = atom(
    null,
    (get, set, userData: Partial<BaseUser>) => {
        const currentUser = get(userAtom)
        set(userAtom, { ...currentUser, ...userData })
    }
)

// 重置用户数据的写入原子
export const resetUserAtom = atom(null, (_get, set) => {
    set(userAtom, defaultUser)
})

export const setAccessTokenAtom = atom(
    null,
    (_get, set, accessToken: string) => {
        set(accessTokenAtom, accessToken)
    }
)

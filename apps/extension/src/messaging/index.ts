import { defineExtensionMessaging } from "@webext-core/messaging"

import type { ExtensionProtocolMap } from "./protocol"

export const { onMessage, sendMessage } =
    defineExtensionMessaging<ExtensionProtocolMap>()

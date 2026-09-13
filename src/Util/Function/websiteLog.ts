/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020-2025 Carolina Mitchell, John Burke, Advaith Jagathesan

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { MessageCreateOptions } from "discord.js";
import * as discord from "../Services/discord.ts";
import { escapeFormatting } from "./main.ts";

/**
 * Post the standard line to the website log channel (discord.channels.logs,
 * the public channel anyone on the DEL server can read) when a user or a
 * system acts on a listing:
 *
 *     <emoji> **<actor>** <action> **<name>** (`<id>`)<suffix>
 *
 * `by` is the acting user's request, shown as their escaped name and ID, or a
 * system name such as "AutoSync System", shown as it is. The listing name is
 * escaped for Discord markdown, `suffix` is appended verbatim (usually
 * "\n<link>"), and `embeds` go out with the line. Returns the send() promise
 * for the caller to await or catch. Not for the moderator-only alerts channel.
 */
export function logWebsiteAction(
    by: AuthedRequest | string,
    emoji: string,
    action: string,
    name: string,
    id: string,
    {
        suffix = "",
        embeds
    }: { suffix?: string; embeds?: MessageCreateOptions["embeds"] } = {}
) {
    const actor =
        typeof by === "string"
            ? `**${by}**`
            : `**${escapeFormatting(by.user.db.fullUsername)}** \`(${by.user.id})\``;

    return discord.channels.logs.send({
        content: `${emoji} ${actor} ${action} **${escapeFormatting(name)}** \`(${id})\`${suffix}`,
        embeds
    });
}

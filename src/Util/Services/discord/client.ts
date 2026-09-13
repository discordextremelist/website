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

// The website's Discord client and its REST helper.

import * as Discord from "discord.js";
import { GatewayIntentBits, Options, Partials } from "discord.js";

export const DAPI = "https://discord.com/api/v10";

export const bot = new Discord.Client({
    allowedMentions: { parse: [] },
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.GuildMember],
    makeCache: Options.cacheWithLimits({
        GuildMemberManager: Infinity
    })
});

/**
 * bot.rest.get with the response typed as T. discord.js types REST#get as
 * returning Promise<unknown>; this narrows the type and nothing else. The
 * request is exactly the same.
 */
export function restGet<T>(
    ...args: Parameters<typeof bot.rest.get>
): Promise<T> {
    return bot.rest.get(...args) as Promise<T>;
}

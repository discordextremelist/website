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

// The DEL servers and channels, and member lookups in them.

import type * as Discord from "discord.js";
import settings from "../../../../settings.json" with { type: "json" };
import { bot } from "./client.ts";

// There is a chance this will fail on recent bot restart if it didn't cache the channel yet.
// Using .fetch() will by default cache the channel on success, and then from there it shouldn't need to again
// (So on a cold cache these return the fetch's promise, cast to the type the
// caller expects: ISSUES I-23.)
const cachedChannel = (id: string) =>
    (bot.channels.cache.has(id)
        ? bot.channels.cache.get(id)
        : (async () => {
              await bot.channels.fetch(id);
          })()) as Discord.TextChannel;

const cachedGuild = (id: string) =>
    (bot.guilds.cache.has(id)
        ? bot.guilds.cache.get(id)
        : (async () => {
              await bot.guilds.fetch(id);
          })()) as Discord.Guild;

export const channels = {
    get logs() {
        return cachedChannel(settings.channels.webLog);
    },
    get alerts() {
        return cachedChannel(settings.channels.alerts);
    }
};

export const guilds = {
    get main() {
        return cachedGuild(settings.guild.main);
    },
    get testing() {
        return cachedGuild(settings.guild.staff);
    },
    get bot() {
        return cachedGuild(settings.guild.bot);
    }
};

export async function getMember(id: string) {
    if (guilds.main) {
        const mainMember = await guilds.main.members.fetch(id).catch(() => {});
        if (mainMember) return mainMember;
        return await guilds.bot.members.fetch(id).catch(() => {});
    } else return undefined;
}

export async function getTestingGuildMember(id: string) {
    if (guilds.testing) {
        return guilds.testing.members.fetch(id).catch(() => {});
    } else return undefined;
}

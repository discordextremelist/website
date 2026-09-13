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

export const channels = {
    // There is a chance this will fail on recent bot restart if it didn't cache the channel yet.
    // Using .fetch() will by default cache the channel on success, and then from there it shouldn't need to again
    get logs() {
        return (
            bot.channels.cache.has(settings.channels.webLog)
                ? bot.channels.cache.get(settings.channels.webLog)
                : (async () => {
                      await bot.channels.fetch(settings.channels.webLog);
                  }).call(this)
        ) as Discord.TextChannel;
    },
    get alerts() {
        return (
            bot.channels.cache.has(settings.channels.alerts)
                ? bot.channels.cache.get(settings.channels.alerts)
                : (async () => {
                      await bot.channels.fetch(settings.channels.alerts);
                  }).call(this)
        ) as Discord.TextChannel;
    }
};

export const guilds = {
    // same thing as the channels above
    get main() {
        return (
            bot.guilds.cache.has(settings.guild.main)
                ? bot.guilds.cache.get(settings.guild.main)
                : (async () => {
                      await bot.guilds.fetch(settings.guild.main);
                  }).call(this)
        ) as Discord.Guild;
    },
    get testing() {
        return (
            bot.guilds.cache.has(settings.guild.staff)
                ? bot.guilds.cache.get(settings.guild.staff)
                : (async () => {
                      await bot.guilds.fetch(settings.guild.staff);
                  }).call(this)
        ) as Discord.Guild;
    },
    get bot() {
        return (
            bot.guilds.cache.has(settings.guild.bot)
                ? bot.guilds.cache.get(settings.guild.bot)
                : (async () => {
                      await bot.guilds.fetch(settings.guild.bot);
                  }).call(this)
        ) as Discord.Guild;
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

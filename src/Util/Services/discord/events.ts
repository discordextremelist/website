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

// Client events that aren't about presence: bans, and startup caching.

import settings from "../../../../settings.json" with { type: "json" };
import { hostname } from "os";
import chunk from "chunk";
import * as botCache from "../cache/botCaching.ts";
import { bot } from "./client.ts";
import { guilds } from "./guilds.ts";
import { uploadStatuses } from "./statuses.ts";

bot.on("guildBanRemove", async (ban) => {
    if (ban.guild.id === settings.guild.main) {
        await global.redis?.hdel("bans", ban.user.id);
    }
});

bot.on("ready", async (client) => {
    console.log(`Discord: Connected as ${client.user.tag} (${client.user.id})`);

    await uploadStatuses();

    const lock = await global.redis.get("fetch_lock");

    if (lock && lock != hostname()) {
        console.log(
            `Skipping discord caching. The instance which holds the lock is: ${lock}`
        );
    } else {
        console.time("Cache: Bot cache");
        const bots = await botCache.getAllBots();
        const botsToFetch: string[] = [];
        if (bots.length < 1)
            return console.log(
                "Failed to get cached bots, or array is empty (check cache)!"
            );
        console.log("Total bots: ", bots.length);
        console.log(
            `Total cache entries: main=${guilds.main.members.cache.size}, bots=${guilds.bot.members.cache.size}`
        );
        bots.forEach((bot) => {
            if (!guilds.main.members.cache.has(bot._id)) {
                botsToFetch.push(bot._id);
            } else if (!guilds.bot.members.cache.has(bot._id)) {
                botsToFetch.push(bot._id);
            }
        });
        const beforePrimary = guilds.main.members.cache.size;
        const beforeSecondary = guilds.bot.members.cache.size;
        let chunks = chunk<string>(botsToFetch, 750);
        for (const chunk of chunks) {
            let botsMain = await guilds.main.members
                .fetch({ user: chunk })
                .catch(console.error);
            if (botsMain) {
                console.log(
                    `Successfully fetched ${botsMain.size} bots in main server!`
                );
                console.log(
                    `Cache size after fetching: ${guilds.main.members.cache.size}`
                );
            }
            let botsSecondary = await guilds.main.members
                .fetch({ user: chunk })
                .catch(console.error);
            if (botsSecondary) {
                console.log(
                    `Successfully fetched ${botsSecondary.size} bots in bots server!`
                );
                console.log(
                    `Cache size after fetching: ${guilds.bot.members.cache.size}`
                );
            }
        }
        const afterPrimary = guilds.main.members.cache.size;
        const afterSecondary = guilds.bot.members.cache.size;
        console.log(
            `Cache grew by ${afterPrimary - beforePrimary} entries for primary, ${afterSecondary - beforeSecondary} secondary.`
        );
        if (!(await redis.get("chan_update_lock"))) {
            await redis.setex("chan_update_lock", 60 * 60 * 1000, hostname()); // Expire every hour (in-case DEL restarts)
        }
        const member_chan =
            guilds.main.channels.cache.get("618583328458670090"); // Too lazy to put in settings.json
        if (member_chan) {
            await member_chan.edit({
                name: `Member Count: ${afterPrimary}`
            });
            if ((await redis.get("chan_update_lock")) == hostname()) {
                console.log("Updating member channel, every 30 minutes!");
                setInterval(async () => {
                    // If this was rust, use of moved value.
                    await member_chan.edit({
                        name: `Member Count: ${guilds.bot.members.cache.size}`
                    });
                }, 30 * 60000);
            }
        }
        await global.redis.del("fetch_lock");
    }
});

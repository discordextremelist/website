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

import * as Discord from "discord.js";
import metrics from "datadog-metrics";

import settings from "../../../settings.json" with { type: "json" };
import moment from "moment";
import { PresenceUpdateStatus, GatewayIntentBits } from "discord.js";
import * as botCache from "./botCaching.ts";
import { hostname } from "os";

export const DAPI = "https://discord.com/api/v10";

const prefix = "statuses";
// If someone is to self-host or contribute, setting datadog metrics is a lot,
// if they have nothing set in the secret section of settings.json, let's ignore metrics - AJ
if (settings.secrets.datadog)
    metrics.init({ host: "", prefix: "", apiKey: settings.secrets.datadog });

// Let's not query the database of users, and bots, and then make changes to it every 5 seconds, that would be a good thing not to do
setInterval(async () => {
    await postWebMetric("user");
    await postWebMetric("bot_unapproved");
    await postTodaysGrowth();
}, 8.568e7); // 23.8h, to account for eventual time drift if the site is online for a while (which is the goal lol) - AJ

export const bot = new Discord.Client({
    allowedMentions: { parse: [] },
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

bot.on("guildBanRemove", async (ban) => {
    if (ban.guild.id === settings.guild.main) {
        await global.redis?.hdel("bans", ban.user.id);
    }
});

bot.on("ready", async () => {
    console.log(`Discord: Connected as ${bot.user.tag} (${bot.user.id})`);

    await uploadStatuses();

    const lock = await global.redis.get("fetch_lock");

    if (lock && lock != hostname()) {
        console.log(
            `Skipping discord caching. The instance which holds the lock is: ${lock}`
        );
    } else {
        console.time("Cache: Bot cache");
        botCache
            .getAllBots()
            .then(async (bots) => {
                const botsToFetch = [];
                bots.forEach(async (bot) => {
                    if (guilds.main.members.cache.has(bot._id)) {
                        botsToFetch.push(bot._id);
                    } else if (guilds.bot.members.cache.has(bot._id)) {
                        botsToFetch.push(bot._id);
                    }
                });
                guilds.main.members
                    .fetch({ user: botsToFetch })
                    .then((x) =>
                        console.log(`Discord main_server: Retrieved ${x.size} members!`)
                    )
                    .catch(() => null); // It is most likely that DEL has another instance running to handle this, so catch the error and ignore.
                guilds.bot.members
                    .fetch({ user: botsToFetch })
                    .then((x) =>
                        console.log(`Discord bot_server: Retrieved ${x.size} members!`)
                    )
                    .catch(() => null); // It is most likely that DEL has another instance running to handle this, so catch the error and ignore.
            })
            .catch((e) => console.error(e));
        console.timeEnd("Cache: Bot cache");
        await global.redis.del("fetch_lock");
    }
});

bot.on("presenceUpdate", async (_oldPresence, newPresence) => {
    if (newPresence.member)
        await global.redis?.hmset(
            prefix,
            newPresence.member.id,
            newPresence.status || PresenceUpdateStatus.Offline
        );
});

bot.on("guildMemberAdd", async (member) => {
    await global.redis?.hmset(
        prefix,
        member.id,
        member.presence
            ? member.presence.status || PresenceUpdateStatus.Offline
            : PresenceUpdateStatus.Offline
    );

    if (member.guild.id === settings.guild.main) await postMetric();
});

bot.on("guildMemberRemove", async (member) => {
    if (member.guild.id === settings.guild.main) {
        await global.redis?.hmset(
            prefix,
            member.id,
            PresenceUpdateStatus.Offline
        );
        await postMetric();
    }
});
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
            bot.channels.cache.has(settings.channels.webLog)
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

export async function getStatus(id: string) {
    const status = (await global.redis?.hget(
        prefix,
        id
    )) as PresenceUpdateStatus;
    return status || PresenceUpdateStatus.Offline;
}

export async function uploadStatuses() {
    await bot.guilds.fetch();

    bot.guilds.cache.forEach(async (g) => {
        await g.members.fetch({ withPresences: true });
    });

    await Promise.all(
        bot.guilds.cache.map(
            async (g) =>
                await global.redis?.hmset(
                    prefix,
                    ...g.members.cache.map((m) => [m.id, m.presence?.status])
                )
        )
    );
}

export async function postMetric() {
    const guild = guilds.main;
    if (guild && settings.secrets.datadog)
        metrics.gauge("del.server.memberCount", (await guild).memberCount);
}
export async function postSpecificMetric(metric: string, gauge: number) {
    if (settings.secrets.datadog) metrics.gauge(`${metric}`, gauge);
}
export async function postWebMetric(type: string) {
    if (!global.db) return;
    switch (type) {
        case "bot":
            const bots = await global.db
                .collection<delBot>("bots")
                .estimatedDocumentCount();
            if (settings.secrets.datadog)
                settings.website.dev
                    ? metrics.gauge("del.website.dev.botCount", bots)
                    : metrics.gauge("del.website.botCount", bots);

            const todaysGrowth = await global.db
                .collection("webOptions")
                .findOne({ _id: "todaysGrowth" });
            if (todaysGrowth) {
                await global.db.collection("webOptions").updateOne(
                    { _id: "todaysGrowth" },
                    {
                        $set: {
                            count: (todaysGrowth.count += 1)
                        }
                    }
                );
            } else {
                await global.db.collection<any>("webOptions").insertOne({
                    _id: "todaysGrowth",
                    count: 1,
                    lastPosted: Date.now()
                });
            }

            break;
        case "bot_unapproved":
            const unapprovedBots = await global.db
                .collection<delBot>("bots")
                .countDocuments({
                    $and: [
                        { "status.archived": false },
                        { "status.approved": false }
                    ]
                });

            if (settings.secrets.datadog)
                settings.website.dev
                    ? metrics.gauge(
                          "del.website.dev.botCount.unapproved",
                          unapprovedBots
                      )
                    : metrics.gauge(
                          "del.website.botCount.unapproved",
                          unapprovedBots
                      );
            break;
        case "server":
            const servers = settings.secrets.datadog
                ? await global.db
                      .collection<delServer>("servers")
                      .estimatedDocumentCount()
                : 0;

            if (settings.secrets.datadog)
                settings.website.dev
                    ? metrics.gauge("del.website.dev.serverCount", servers)
                    : metrics.gauge("del.website.serverCount", servers);
            break;
        case "template":
            // if they aren't using datadog, don't make an unnecessary query
            const templates = settings.secrets.datadog
                ? await global.db
                      .collection<delTemplate>("templates")
                      .estimatedDocumentCount()
                : 0;
            if (settings.secrets.datadog)
                settings.website.dev
                    ? metrics.gauge("del.website.dev.templateCount", templates)
                    : metrics.gauge("del.website.templateCount", templates);
            break;
        case "user":
            const users = await global.db
                .collection<delUser>("users")
                .estimatedDocumentCount();
            if (settings.secrets.datadog)
                settings.website.dev
                    ? metrics.gauge("del.website.dev.userCount", users)
                    : metrics.gauge("del.website.userCount", users);
            break;
    }
}

export async function postTodaysGrowth() {
    const todaysGrowth: botsAddedToday = await global.db
        .collection<botsAddedToday>("webOptions")
        .findOne({ _id: "todaysGrowth" });
    if (!todaysGrowth)
        return await global.db.collection<any>("webOptions").insertOne({
            _id: "todaysGrowth",
            count: 0,
            lastPosted: Date.now()
        });

    const date = moment().diff(moment(todaysGrowth.lastPosted), "days");

    if (date >= 1) {
        if (settings.secrets.datadog)
            settings.website.dev
                ? metrics.gauge(
                      "del.website.dev.addedBotsToday",
                      todaysGrowth.count
                  )
                : metrics.gauge(
                      "del.website.addedBotsToday",
                      todaysGrowth.count
                  );

        await global.db.collection("webOptions").updateOne(
            { _id: "todaysGrowth" },
            {
                $set: {
                    count: 0,
                    lastPosted: Date.now()
                }
            }
        );
    } else return;
}

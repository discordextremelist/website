/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020 Cairo Mitchell-Acason, John Burke, Advaith Jagathesan

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
import * as metrics from "datadog-metrics";

import * as settings from "../../../settings.json";
import moment from "moment";
import { PresenceUpdateStatus } from "discord-api-types/v8";
import * as botCache from "./botCaching";

const prefix = "statuses";

metrics.init({ host: "", prefix: "", apiKey: settings.secrets.datadog });

// @ts-expect-error
class Client extends Discord.Client {
    readonly api: {
        applications: any;
        channels: any;
        gateway: any;
        guilds: any;
        invites: any;
        oauth2: any;
        users: any;
        voice: any;
        webhooks: any;
    }
}

export const bot = new Client({
    allowedMentions: { parse: [] },
    ws: { intents: ["GUILDS", "GUILD_MEMBERS", "GUILD_PRESENCES"] },
    http: { version: 8 }
});

bot.on("guildBanRemove", async (guild, user) => {
   if (guild.id === settings.guild.main) {
       await global.redis?.hdel("bans", user.id);
   }
});

bot.on("ready", async () => {
    console.log(`Discord: Connected as ${bot.user.tag} (${bot.user.id})`);
    if (process.env.EXECUTOR === "pm2") {
        process.send("ready");
        console.log("PM2: Ready signal sent");
    }

    await uploadStatuses();

    botCache.getAllBots().then(bots => {
        const botsToFetch = []
        bots.forEach(bot => {
            if (!guilds.main.members.cache.has(bot._id)) botsToFetch.push(bot._id)
        })
        guilds.main.members.fetch({user: botsToFetch})
    })
});

bot.on("presenceUpdate", async (oldPresence, newPresence) => {
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
        member.presence.status || PresenceUpdateStatus.Offline
    );

    if (member.guild.id === settings.guild.main) await postMetric();
});

bot.on("guildMemberRemove", async (member) => {
    if (member.guild.id === settings.guild.main) {
        await global.redis?.hmset(prefix, member.id, PresenceUpdateStatus.Offline);
        await postMetric();
    }
});

export const channels = {
    get logs() { return bot.channels.cache.get(settings.channels.webLog) as Discord.TextChannel },
    get alerts() { return bot.channels.cache.get(settings.channels.alerts) as Discord.TextChannel }
}

export const guilds = {
    get main() { return bot.guilds.cache.get(settings.guild.main) },
    get testing() { return bot.guilds.cache.get(settings.guild.staff) },
}

export async function getMember(id: string) {
    if (guilds.main) {
        return await guilds.main.members.fetch(id).catch(() => {});
    } else return undefined;
}

export async function getTestingGuildMember(id: string) {
    if (guilds.testing) {
        return await guilds.testing.members.fetch(id).catch(() => {});
    } else return undefined;
}

export async function getStatus(id: string) {
    const status = await global.redis?.hget(prefix, id) as PresenceUpdateStatus;
    return status || PresenceUpdateStatus.Offline;
}

export async function uploadStatuses() {
    await Promise.all(
        bot.guilds.cache.map(
            async (g) =>
                await global.redis?.hmset(
                    prefix,
                    ...g.members.cache.map((m) => [m.id, m.presence.status])
                )
        )
    );
}

export async function postMetric() {
    const guild = guilds.main;
    if (guild) metrics.gauge("del.server.memberCount", guild.memberCount);
}

export async function postWebMetric(type: string) {
    if (!global.db) return
    const bots: delBot[] = await global.db.collection("bots").find().toArray();

    const servers: delServer[] = await global.db
        .collection("servers")
        .find()
        .toArray();

    const templates: delTemplate[] = await global.db
        .collection("templates")
        .find()
        .toArray();

    const users: delUser[] = await global.db
        .collection("users")
        .find()
        .toArray();

    switch (type) {
        case "bot":
            settings.website.dev
                ? metrics.gauge("del.website.dev.botCount", bots.length)
                : metrics.gauge("del.website.botCount", bots.length);

            const todaysGrowth = await global.db
                .collection("webOptions")
                .findOne({ _id: "todaysGrowth" });
            if (todaysGrowth) {
                await global.db.collection("webOptions").updateOne(
                    { _id: "todaysGrowth" },
                    {
                        $set: {
                            count: todaysGrowth.count += 1
                        }
                    }
                );
            } else {
                await global.db.collection("webOptions").insertOne({
                    _id: "todaysGrowth",
                    count: 1,
                    lastPosted: Date.now()
                });
            }

            break;
        case "bot_unapproved":
            const unapprovedBots = bots.filter(
                (b) => !b.status.approved && !b.status.archived
            );

            settings.website.dev
                ? metrics.gauge(
                      "del.website.dev.botCount.unapproved",
                      unapprovedBots.length
                  )
                : metrics.gauge(
                      "del.website.botCount.unapproved",
                      unapprovedBots.length
                  );
            break;
        case "server":
            settings.website.dev
                ? metrics.gauge("del.website.dev.serverCount", servers.length)
                : metrics.gauge("del.website.serverCount", servers.length);
            break;
        case "template":
            settings.website.dev
                ? metrics.gauge(
                      "del.website.dev.templateCount",
                      templates.length
                  )
                : metrics.gauge("del.website.templateCount", templates.length);
            break;
        case "user":
            settings.website.dev
                ? metrics.gauge("del.website.dev.userCount", users.length)
                : metrics.gauge("del.website.userCount", users.length);
            break;
    }
}

export async function postTodaysGrowth() {
    const todaysGrowth: botsAddedToday = await global.db
        .collection("webOptions")
        .findOne({ _id: "todaysGrowth" });
    if (!todaysGrowth)
        return await global.db.collection("webOptions").insertOne({
            _id: "todaysGrowth",
            count: 0,
            lastPosted: Date.now()
        });

    const date = moment().diff(moment(todaysGrowth.lastPosted), "days");

    if (date >= 1) {
        settings.website.dev
            ? metrics.gauge(
                  "del.website.dev.addedBotsToday",
                  todaysGrowth.count
              )
            : metrics.gauge("del.website.addedBotsToday", todaysGrowth.count);

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

setInterval(async () => {
    postWebMetric("user");
    postWebMetric("bot_unapproved");
    await postTodaysGrowth();
}, 5000);

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
const prefix = "statuses";

metrics.init({ host: "", prefix: "", apiKey: settings.secrets.datadog });

export const bot = new Discord.Client({
    allowedMentions: { parse: [] },
    ws: { intents: ["GUILDS", "GUILD_MEMBERS", "GUILD_PRESENCES"] }
});

bot.on("ready", async () => {
    console.log(`Discord: Connected as ${bot.user.tag} (${bot.user.id})`);
    if (process.env.EXECUTOR === "pm2") {
        process.send("ready");
        console.log("PM2: Ready signal sent");
    }

    await uploadStatuses();
});

bot.on("presenceUpdate", async (oldPresence, newPresence) => {
    await global.redis.hmset(
        prefix,
        newPresence.member.id,
        newPresence.status || "offline"
    );
});

bot.on("guildMemberAdd", async (member) => {
    await global.redis.hmset(
        prefix,
        member.id,
        member.presence.status || "offline"
    );

    if (member.guild.id === settings.guild.main) await postMetric();
});

bot.on("guildMemberRemove", async (member) => {
    if (member.guild.id === settings.guild.main) {
        await global.redis.hmset(prefix, member.id, "offline");
        await postMetric();
    }
});

export const mainGuild = bot.guilds.cache.get(settings.guild.main);
export const staffGuild = bot.guilds.cache.get(settings.guild.staff);
export const logsChannel = bot.channels.cache.get(
    settings.channels.webLog
) as Discord.TextChannel;
export const alertsChannel = bot.channels.cache.get(
    settings.channels.alerts
) as Discord.TextChannel;

export function getMember(id: string): Discord.GuildMember | undefined {
    if (mainGuild) {
        const member:
            | Discord.GuildMember
            | undefined = mainGuild.members.cache.get(id);
        return member;
    } else return undefined;
}

export async function getStatus(id: string): Promise<string> {
    const status: string = await global.redis.hget(prefix, id);
    return status || "offline";
}

export async function uploadStatuses() {
    await Promise.all(
        bot.guilds.cache.map(
            async (g) =>
                await global.redis.hmset(
                    prefix,
                    ...g.members.cache.map((m) => [m.id, m.presence.status])
                )
        )
    );
}

export async function postMetric() {
    const guild = bot.guilds.cache.get(settings.guild.main);
    if (guild) metrics.gauge("del.server.memberCount", guild.memberCount);
}

bot.login(settings.secrets.discord.token);

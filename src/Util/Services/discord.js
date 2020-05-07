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

const Eris = require("eris-additions")(require("eris"));

const settings = require("../../../settings.json");
const prefix = "statuses";

const bot = new Eris.Client(settings.client.token);

bot.on("ready", async () => {
    console.log(`Discord: Connected as ${bot.user.tag} (${bot.user.id})`);
    if (process.env.EXECUTOR === "pm2") {
        process.send("ready");
        console.log("PM2: Ready signal sent");
    }

    await uploadStatuses();
});

bot.on("presenceUpdate", async (other, oldPresence) => {
    await global.redis.hmset(prefix, other.id, other.status || "offline");
});

bot.on("guildMemberAdd", async (guild, member) => {
    await global.redis.hmset(prefix, member.id, member.status || "offline");
})

bot.on("guildMemberRemove", async (guild, member) => {
    if (guild.id === settings.guild.main) {
        await global.redis.hmset(prefix, member.id, "offline");
    }
})

async function getStatus(id) {
    const status = await global.redis.hget(prefix, id);
    return status || "offline";
}

async function uploadStatuses() {
    await Promise.all(bot.guilds.map(async g => await global.redis.hmset(prefix, ...g.members.map(m => [m.id, m.status]))));
}

bot.connect();

module.exports = {
    bot, getStatus, uploadStatuses
};

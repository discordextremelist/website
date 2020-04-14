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
const ioRedis = require("ioredis");

const settings = require("../../../settings.json");
const redisStatus = new ioRedis(settings.db.redis.statuses);

const bot = new Eris.Client(settings.client.token);

bot.on("ready", async () => {
    console.log("Website: Started website/bot hook");
    if (process.env.EXECUTOR === "pm2") {
        process.send("ready");
        console.log("PM2: Ready signal sent");
    }

    await uploadStatuses();
    // setInterval(() => {
    //     if (count > 1) {
    //         discord.bot.editStatus({
    //             status: "online",
    //             game: {
    //                 name: `${count} listed bots ($)`,
    //                 type: "WATCHING"
    //             }
    //         });
    //     } else if (count === 1) {
    //         discord.bot.editStatus({
    //             status: "online",
    //             game: {
    //                 name: `${count} listed bot ($)`,
    //                 type: "WATCHING"
    //             }
    //         });
    //     } else if (count === 0) {
    //         discord.bot.editStatus({
    //             status: "online",
    //             game: {
    //                 name: `No listed bots ($)`,
    //                 type: "WATCHING"
    //             }
    //         });
    //     } else {
    //         discord.bot.editStatus({
    //             status: "online",
    //             game: {
    //                 name: `${count} listed bot(s) ($)`,
    //                 type: "WATCHING"
    //             }
    //         });
    //     }
    // }, 900000);
});

bot.on("presenceUpdate", (other, oldPresence) => {
    redisStatus.set(other.id, other.status || "offline");
});

bot.on("guildMemberAdd", (guild, member) => {
    redisStatus.set(member.id, member.status || "offline");
})

bot.on("guildMemberRemove", (guild, member) => {
    if (guild.id === settings.guild.main) {
        redisStatus.set(member.id, "offline");
    }
})

async function getStatus(id) {
    const status = await redisStatus.get(id);
    return status || "offline";
}

async function uploadStatuses() {
    const statuses = {};

    bot.guilds.forEach((guild) => {
        guild.members.forEach((member) => {
            statuses[member.id] = member.status || "offline";
        });
    });

    const keys = Object.keys(statuses);

    for (let n = 0; n < keys.length; n += 1000) {
        const slicedStatuses = {};
        const slicedKeys = keys.slice(n, n + 1000);

        for (let nn = 0; nn < slicedKeys.length; nn++) {
            slicedStatuses[slicedKeys[nn]] = statuses[slicedKeys[nn]];
        }

        redisStatus.mset(slicedStatuses);
    }
}

bot.connect();

module.exports = {
    bot, getStatus
};

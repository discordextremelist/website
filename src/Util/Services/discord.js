const Eris = require("eris-additions")(require("eris"));
const ioRedis = require("ioredis");

const settings = require("../../../settings.json");
const functions = require("../Function/main.js");
const redisStatus = new ioRedis(settings.db.redis.statuses);

const bot = new Eris.Client(settings.client.token);

bot.on("ready", async () => {
    console.log("Website: Started website/bot hook");
    if (process.env.EXECUTOR === "pm2") {
        process.send("ready");
        console.log("PM2: Ready signal sent");
    }

    await functions.statusUpdate;
    await uploadStatuses();
});

bot.on("presenceUpdate", (other, oldPresence) => {
    redisStatus.set(other.id, other.status || "offline");
});

bot.on("guildMemberAdd", (guild, member) => {
    redisStatus.set(member.id, member.status || "offline");
})

bot.on("guildMemberRemove", (guild, member) => {
    // todo - fix this, it's not an ideal solution
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

    for (let i = 0; i < keys.length; i += 1000) {
        const slicedStatuses = {};
        const slicedKeys = keys.slice(i, i + 1000);

        for (let j = 0; j < slicedKeys.length; j++) {
            slicedStatuses[slicedKeys[j]] = statuses[slicedKeys[j]];
        }

        redisStatus.mset(slicedStatuses);
    }
}

bot.connect();

module.exports = {
    bot, getStatus
};

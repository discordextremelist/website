const ioRedis = require("ioredis");
const cron = require("node-cron");

const settings = require("../../../settings.json");
const functions = require("../Function/main.js");
const app = require("../../../app.js");
const discord = require("./discord.js");
const redisBans = new ioRedis(settings.db.redis.bans);

async function check(user) {
    const rawBans = await redisBans.get("bans");
    const bans = JSON.parse(rawBans);

    let banned = false;
    
    for (var n = 0; n < bans.length; ++n) {
        const ban = bans[n];
        
        if (ban.user.id === user) banned = true;
    }

    return banned;
}

async function updateBanlist() {
    const bans = discord.bot.guilds.get(settings.guild.main).getBans();
    redisBans.set("bans", JSON.stringify(bans));
}

cron.schedule("*/15 * * * *", async () => {
    await updateBanlist();
});

module.exports = {
    check,
    updateBanlist
};

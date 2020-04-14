const ioRedis = require("ioredis");

const app = require("../../../app.js");
const settings = require("../../../settings.json");
const redisBotCache = new ioRedis(settings.db.redis.caching.bots);

async function getBot(id) {
    const bot = await redisBotCache.get(id);
    return JSON.parse(bot);
}

async function getAllBots() {
    const bots = await redisBotCache.get("all");
    return JSON.parse(bots) || null;
}

async function updateBot(id) {
    const data = await app.db.collection("bots").findOne({ id: id });
    redisBotCache.set(id, JSON.stringify(data));
}

async function uploadBots() {
    const bots = {};
    const botsDB = await app.db.collection("bots").find().toArray();

    botsDB.forEach((bot) => {
        bots[bot.id] = JSON.stringify(bot);
    });

    const keys = Object.keys(bots);

    for (let n = 0; n < keys.length; n += 1000) {
        const slicedData = {};
        const slicedKeys = keys.slice(n, n + 1000);

        for (let nn = 0; nn < slicedKeys.length; nn++) {
            slicedData[slicedKeys[nn]] = bots[slicedKeys[nn]];
        }

        redisBotCache.mset(slicedData);
    }
}

async function uploadAllBots() {
    const bots = (await app.db.collection("bots").find().toArray()).filter(({status}) => status.approved && !status.siteBot && !status.archived);
    redisBotCache.set("all", JSON.stringify(bots));
}

setInterval(async () => {
    await uploadBots();
    await uploadAllBots();
}, 900000);

module.exports = {
    getBot, getAllBots, updateBot, uploadBots, uploadAllBots
};

const ioRedis = require("ioredis");
const cron = require("node-cron");

const settings = require("../../../settings.json");
const functions = require("../Function/main.js");
const app = require("../../../app.js");
const redisFeaturing = new ioRedis(settings.db.redis.featuring);

async function getFeaturedBots() {
    const bots = await redisFeaturing.get("bots");
    return JSON.parse(bots);
}

async function getFeaturedServers() {
    const servers = await redisFeaturing.get("servers");
    return JSON.parse(servers);
}

async function updateFeaturedBots() {
    const bots = await app.db.collection("bots").aggregate({ $filter: { status: { approved: true, siteBot: false, archived: false } }, $limit: 3 }).toArray();
    redisFeaturing.set("bots", JSON.stringify(bots));
}

async function updateFeaturedServers() {
    const servers = await app.db.collection("servers").aggregate({ $limit: 3 }).toArray();
    redisFeaturing.set("servers", JSON.stringify(servers));
}

cron.schedule("*/15 * * * *", async () => {
    console.log("EXEC")
    await updateFeaturedBots();
    await updateFeaturedServers();
});

module.exports = {
    getFeaturedBots,
    getFeaturedServers,
    updateFeaturedBots, 
    updateFeaturedServers
};

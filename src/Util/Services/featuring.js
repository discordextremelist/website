const ioRedis = require("ioredis");

const settings = require("../../../settings.json");
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
    const bots = (await app.db.collection("bots").aggregate({ $limit: 6 }).toArray()).filter(({status}) => status.approved && !status.siteBot && !status.archived);
    redisFeaturing.set("bots", JSON.stringify(bots));
}

async function updateFeaturedServers() {
    const servers = await app.db.collection("servers").aggregate({ $limit: 6 }).toArray();
    redisFeaturing.set("servers", JSON.stringify(servers));
}

setInterval(async () => {
    await updateFeaturedBots();
    await updateFeaturedServers();
}, 900000);

module.exports = {
    getFeaturedBots,
    getFeaturedServers,
    updateFeaturedBots, 
    updateFeaturedServers
};

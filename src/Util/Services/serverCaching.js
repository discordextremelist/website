const ioRedis = require("ioredis");

const app = require("../../../app.js");
const settings = require("../../../settings.json");
const redisServerCache = new ioRedis(settings.db.redis.caching.servers);

async function getServer(id) {
    const server = await redisServerCache.get(id);
    return JSON.parse(server) || null;
}

async function getAllServers() {
    const servers = await redisServerCache.get("all");
    return JSON.parse(servers) || null;
}

async function updateServer(id) {
    const data = await app.db.collection("servers").findOne({ id: id });
    redisServerCache.set(id, JSON.stringify(data));
}

async function uploadServers() {
    const servers = {};
    const serversDB = await app.db.collection("servers").find().toArray();

    serversDB.forEach((server) => {
        servers[server.id] = JSON.stringify(server);
    });

    const keys = Object.keys(servers);

    for (let n = 0; n < keys.length; n += 1000) {
        const slicedData = {};
        const slicedKeys = keys.slice(n, n + 1000);

        for (let nn = 0; nn < slicedKeys.length; nn++) {
            slicedData[slicedKeys[nn]] = servers[slicedKeys[nn]];
        }

        redisServerCache.mset(slicedData);
    }
}

async function uploadAllServers() {
    const servers = await app.db.collection("servers").find().toArray();
    redisServerCache.set("all", JSON.stringify(servers));
}

setInterval(async () => {
    await uploadServers();
    await uploadAllServers();
}, 900000);

module.exports = {
    getServer, getAllServers, updateServer, uploadServers, uploadAllServers
};

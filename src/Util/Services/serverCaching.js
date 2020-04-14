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

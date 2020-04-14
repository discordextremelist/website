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

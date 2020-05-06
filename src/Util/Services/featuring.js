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

const settings = require("../../../settings.json");
const app = require("../../../app.js");

async function getFeaturedBots() {
    const bots = await global.redis.get("featured_bots");
    return JSON.parse(bots);
}

async function getFeaturedServers() {
    const servers = await global.redis.get("featured_servers");
    return JSON.parse(servers);
}

async function updateFeaturedBots() {
    const bots = (await app.db.collection("bots").aggregate({ $limit: 6 }).toArray()).filter(({status}) => status.approved && !status.siteBot && !status.archived);
    await global.redis.set("featured_bots", JSON.stringify(bots));
}

async function updateFeaturedServers() {
    const servers = await app.db.collection("servers").aggregate({ $limit: 6 }).toArray();
    await global.redis.set("featured_servers", JSON.stringify(servers));
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

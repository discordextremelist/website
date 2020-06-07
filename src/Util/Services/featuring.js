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

const app = require("../../../app.js");
const functions = require("../Function/main.js");

async function getFeaturedBots() {
    const bots = await global.redis.get("featured_bots");
    return JSON.parse(bots);
}

async function getFeaturedServers() {
    const servers = await global.redis.get("featured_servers");
    return JSON.parse(servers);
}

async function getFeaturedTemplates() {
    const templates = await global.redis.get("featured_templates");
    return JSON.parse(templates);
}

async function updateFeaturedBots() {
    const bots = functions
        .shuffleArray(
            (await app.db.collection("bots").find().toArray()).filter(
                ({ status }) =>
                    status.approved && !status.siteBot && !status.archived
            )
        )
        .slice(0, 6);
    await global.redis.set("featured_bots", JSON.stringify(bots));
}

async function updateFeaturedServers() {
    const servers = functions
        .shuffleArray(await app.db.collection("servers").find().toArray())
        .slice(0, 6);
    await global.redis.set("featured_servers", JSON.stringify(servers));
}

async function updateFeaturedTemplates() {
    const templates = functions
        .shuffleArray(await app.db.collection("templates").find().toArray())
        .slice(0, 6);
    await global.redis.set("featured_templates", JSON.stringify(templates));
}

setInterval(async () => {
    await updateFeaturedBots();
    await updateFeaturedServers();
    await updateFeaturedTemplates();
}, 900000);

module.exports = {
    getFeaturedBots,
    getFeaturedServers,
    getFeaturedTemplates,
    updateFeaturedBots,
    updateFeaturedServers,
    updateFeaturedTemplates
};

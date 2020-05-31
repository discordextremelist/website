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
const prefix = "servers";

async function getServer(id) {
    const server = await global.redis.hget(prefix, id);
    return JSON.parse(server);
}

async function getAllServers() {
    const servers = await global.redis.hvals(prefix);
    return servers.map(JSON.parse);
}

async function updateServer(id) {
    const data = await app.db.collection("servers").findOne({ _id: id });
    if (!data) return;
    await global.redis.hmset(prefix, id, JSON.stringify(data));
}

async function uploadServers() {
    const servers = await app.db.collection("servers").find().toArray();
    if (servers.length < 1) return;
    await global.redis.hmset(prefix, ...servers.map(s => [s._id, JSON.stringify(s)]));
}

async function deleteServer(id) {
    await global.redis.del(prefix, id);
}

setInterval(async () => {
    await uploadServers();
}, 900000);

module.exports = {
    getServer, getAllServers, updateServer, uploadServers, deleteServer
};

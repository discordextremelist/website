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
const redisUserCache = new ioRedis(settings.db.redis.caching.users);

async function getUser(id) {
    const user = await redisUserCache.get(id);
    return JSON.parse(user) || null;
}

async function updateUser(id) {
    const data = await app.db.collection("users").findOne({ id: id });
    redisUserCache.set(id, JSON.stringify(data));
}

async function uploadUsers() {
    const users = {};
    const usersDB = await app.db.collection("users").find().toArray();

    usersDB.forEach((user) => {
        users[user.id] = JSON.stringify(user);
    });

    const keys = Object.keys(users);

    for (let n = 0; n < keys.length; n += 1000) {
        const slicedData = {};
        const slicedKeys = keys.slice(n, n + 1000);

        for (let nn = 0; nn < slicedKeys.length; nn++) {
            slicedData[slicedKeys[nn]] = users[slicedKeys[nn]];
        }

        redisUserCache.mset(slicedData);
    }
}

setInterval(async () => {
    await uploadUsers();
}, 900000);

module.exports = {
    updateUser, getUser
};

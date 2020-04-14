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

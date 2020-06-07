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
global.libs = [];

function getLibs() {
    return global.libs.sort((a, b) => a._id.localeCompare(b._id));
}

function hasLib(name) {
    return global.libs.find((x) => x._id === name);
}

async function cacheLibs() {
    global.libs = [];
    const dbLibs = await app.db.collection("libraries").find().toArray();
    for (const lib of dbLibs) global.libs.push(lib);
}

async function addLib(
    { name, language, links: { docs, repo } } = {
        name: "",
        language: "",
        links: { docs: "", repo: "" }
    }
) {
    await app.db.collection("libraries").updateOne(
        { _id: name },
        {
            language,
            links: { docs, repo }
        },
        { upsert: true }
    );
    global.libs[global.libs.findIndex((x) => x._id === name)] = {
        language,
        links: { docs, repo }
    };
}

async function removeLib(name) {
    const index = global.libs.findIndex((x) => x._id === name);
    if (index) {
        global.libs.splice(index, 1);
        await app.db.collection("libraries").deleteOne({ _id: name });
    }
}

setInterval(async () => {
    await cacheLibs();
}, 900000);

module.exports = { getLibs, cacheLibs, addLib, removeLib, hasLib };

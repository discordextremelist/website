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
const threshold = 2; // requests/min

global.ddosMode = {
    active: false,
    requests: 0
};

function getDDOSMode() {
    return global.ddosMode;
}

async function activateDDOSMode() {
    await app.db.collection("webOptions").updateOne(
        { _id: "ddosMode" },
        {
            $set: {
                active: true
            }
        }
    );

    global.ddosMode.active = true;
}

async function updateCache() {
    const ddosMode = await app.db
        .collection("webOptions")
        .findOne({ _id: "ddosMode" });
    if (ddosMode) global.ddosMode.active = ddosMode.active;
    return;
}

async function newRequest() {
    global.ddosMode.requests += 1;

    if (global.ddosMode.requests >= threshold) await activateDDOSMode();
}

setInterval(async () => {
    if (global.ddosMode.requests >= threshold) await activateDDOSMode();
}, 60000);

module.exports = {
    getDDOSMode,
    newRequest,
    updateCache
};

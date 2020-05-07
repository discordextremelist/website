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
const serverCache = require("./serverCaching.js");
const fetch = require("node-fetch");

async function update(id, guildObject, queryDapi) {
    if (!queryDapi) queryDapi = true;

    const oldServer = await app.db.collection("servers").findOne({ _id: id });
    if (!oldServer) return;
    const owner = await app.db.collection("users").findOne({ _id: oldServer.owner.id });

    function getGuildFromArray(guilds) {
        return guilds.id === oldServer.id;
    }

    if (queryDapi) {
        fetch(`https://discord.com/api/v7/users/@me/guilds`, {
            headers: {
                Authorization: `Bearer ${owner.token}`
            }
        }).then(async(fetchRes) => {
            fetchRes.jsonBody = await fetchRes.json();
            const newServer = fetchRes.jsonBody.find(getGuildFromArray);
            
            app.db.collection("servers").updateOne({ id }, 
                { $set: {
                    name: newServer.name,
                    icon: {
                        hash: newServer.icon,
                        url: `https://cdn.discordapp.com/icons/${id}/${newServer.icon}`
                    }
                }
            });

            await serverCache.updateServer(id);
        }).catch(fetchErr => { console.error(fetchErr) });
    } else {
        const newServer = guildObject.find(getGuildFromArray);
            
        await app.db.collection("servers").updateOne({ id: id }, 
            { $set: {
                name: newServer.name,
                icon: {
                    hash: newServer.icon,
                    url: `https://cdn.discordapp.com/icons/${id}/${newServer.icon}`
                }
            }
        });
    }
}

module.exports = update;

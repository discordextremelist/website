const app = require("../../../app.js");
const serverCache = require("./serverCaching.js");
const fetch = require("node-fetch");

async function update(id, guildObject, queryDapi) {
    if (queryDapi == undefined) queryDapi = true;

    const oldServer = await app.db.collection("servers").findOne({ id: id });
    if (!oldServer) return;
    const owner = await app.db.collection("users").findOne({ id: oldServer.owner.id });

    function getGuildFromArray(guilds) {
        return guilds.id === oldServer.id;
    }

    if (queryDapi) {
        fetch(`https://discordapp.com/api/v6/users/@me/guilds`, {
            headers: {
                Authorization: `Bearer ${owner.token}`
            }
        }).then(async(fetchRes) => {
            fetchRes.jsonBody = await fetchRes.json();
            const newServer = fetchRes.jsonBody.find(getGuildFromArray);
            
            app.db.collection("servers").updateOne({ id: id }, 
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

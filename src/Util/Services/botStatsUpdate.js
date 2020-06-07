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
const moment = require("moment");

async function update() {
    const botStats = await app.db
        .collection("webOptions")
        .findOne({ _id: "botStats" });

    if (!botStats) {
        return await app.db.collection("webOptions").insertOne({
            _id: "botStats",
            lastUpdate: Date.now()
        });
    }

    const date = moment().diff(moment(botStats.lastUpdate), "days");
    if (date > 7) {
        const users = await app.db.collection("users").find().toArray();
        for (const user of users) {
            if (user.rank.mod === true) {
                await app.db.collection("users").updateOne(
                    { _id: user._id },
                    {
                        $set: {
                            "staffTracking.handledBots.thisWeek.total": 0,
                            "staffTracking.handledBots.thisWeek.approved": 0,
                            "staffTracking.handledBots.thisWeek.declined": 0,
                            "staffTracking.handledBots.thisWeek.remove": 0,
                            "staffTracking.handledBots.prevWeek.total":
                                user.staffTracking.handledBots.thisWeek.total,
                            "staffTracking.handledBots.prevWeek.approved":
                                user.staffTracking.handledBots.thisWeek
                                    .approved,
                            "staffTracking.handledBots.prevWeek.declined":
                                user.staffTracking.handledBots.thisWeek
                                    .declined,
                            "staffTracking.handledBots.prevWeek.remove":
                                user.staffTracking.handledBots.thisWeek.remove
                        }
                    }
                );
            }
        }

        await app.db.collection("webOptions").updateOne(
            { _id: "botStats" },
            {
                $set: {
                    lastUpdate: Date.now()
                }
            }
        );
    }
}

setInterval(async () => {
    await update();
}, 900000);

module.exports = update;

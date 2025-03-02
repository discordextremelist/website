/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020-2025 Carolina Mitchell, John Burke, Advaith Jagathesan

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

import moment from "moment";

export async function botStatsUpdate() {
    const botStats: botStats = await global.db
        .collection<botStats>("webOptions")
        .findOne({ _id: "botStats" });

    if (!botStats) {
        return await global.db.collection<any>("webOptions").insertOne({
            _id: "botStats",
            lastUpdate: Date.now()
        });
    }

    const date = moment().diff(moment(botStats.lastUpdate), "days");
    if (date >= 7) {
        const users: delUser[] = await global.db
            .collection<delUser>("users")
            .find({ "rank.mod": true })
            .toArray();
        for (const user of users) {
            if (user.rank.mod === true) {
                await global.db.collection("users").updateOne(
                    { _id: user._id },
                    {
                        $set: {
                            "staffTracking.handledBots.thisWeek.total": 0,
                            "staffTracking.handledBots.thisWeek.approved": 0,
                            "staffTracking.handledBots.thisWeek.unapprove": 0,
                            "staffTracking.handledBots.thisWeek.declined": 0,
                            "staffTracking.handledBots.thisWeek.remove": 0,
                            "staffTracking.handledBots.thisWeek.modHidden": 0,
                            "staffTracking.handledServers.allTime.declined": 0,
                            "staffTracking.handledServers.allTime.approved": 0,
                            "staffTracking.handledBots.prevWeek.total":
                                user.staffTracking.handledBots.thisWeek.total,
                            "staffTracking.handledBots.prevWeek.approved":
                                user.staffTracking.handledBots.thisWeek
                                    .approved,
                            "staffTracking.handledBots.prevWeek.unapprove":
                                user.staffTracking.handledBots.thisWeek
                                    .unapprove,
                            "staffTracking.handledBots.prevWeek.declined":
                                user.staffTracking.handledBots.thisWeek
                                    .declined,
                            "staffTracking.handledBots.prevWeek.remove":
                                user.staffTracking.handledBots.thisWeek.remove,
                            "staffTracking.handledBots.prevWeek.modHidden":
                                user.staffTracking.handledBots.thisWeek
                                    .modHidden,
                            "staffTracking.handledServers.prevWeek.declined":
                                user.staffTracking.handledServers.thisWeek
                                    .declined,
                            "staffTracking.handledServers.prevWeek.approved":
                                user.staffTracking.handledServers.thisWeek
                                    .approved
                        }
                    }
                );
            }
        }

        await global.db.collection("webOptions").updateOne(
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
    await botStatsUpdate();
}, 900000);

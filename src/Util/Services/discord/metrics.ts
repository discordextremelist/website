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

// Datadog metrics for the DEL server and the website.

import metrics from "datadog-metrics";
import settings from "../../../../settings.json" with { type: "json" };
import moment from "moment";
import { guilds } from "./guilds.ts";

// If someone is to self-host or contribute, setting datadog metrics is a lot,
// if they have nothing set in the secret section of settings.json, let's ignore metrics - AJ
if (settings.secrets.datadog)
    metrics.init({ host: "", prefix: "", apiKey: settings.secrets.datadog });

/** Send a website gauge, named del.website.dev.<name> in development. */
function websiteGauge(name: string, value: number) {
    if (settings.secrets.datadog)
        metrics.gauge(
            `del.website.${settings.website.dev ? "dev." : ""}${name}`,
            value
        );
}

export async function postMetric() {
    const guild = guilds.main;
    if (guild && settings.secrets.datadog)
        metrics.gauge("del.server.memberCount", (await guild).memberCount);
}

export async function postSpecificMetric(metric: string, gauge: number) {
    if (settings.secrets.datadog) metrics.gauge(`${metric}`, gauge);
}

export async function postWebMetric(type: string) {
    if (!global.db) return;
    switch (type) {
        case "bot":
            const bots = await global.db
                .collection<delBot>("bots")
                .estimatedDocumentCount();
            websiteGauge("botCount", bots);

            const todaysGrowth = await global.db
                .collection("webOptions")
                .findOne({ _id: "todaysGrowth" });
            if (todaysGrowth) {
                await global.db.collection("webOptions").updateOne(
                    { _id: "todaysGrowth" },
                    {
                        $set: {
                            count: (todaysGrowth.count += 1)
                        }
                    }
                );
            } else {
                await global.db.collection<any>("webOptions").insertOne({
                    _id: "todaysGrowth",
                    count: 1,
                    lastPosted: Date.now()
                });
            }

            break;
        case "bot_unapproved":
            const unapprovedBots = await global.db
                .collection<delBot>("bots")
                .countDocuments({
                    $and: [
                        { "status.archived": false },
                        { "status.approved": false }
                    ]
                });

            websiteGauge("botCount.unapproved", unapprovedBots);
            break;
        case "server":
            const servers = settings.secrets.datadog
                ? await global.db
                      .collection<delServer>("servers")
                      .estimatedDocumentCount()
                : 0;

            websiteGauge("serverCount", servers);
            break;
        case "template":
            // if they aren't using datadog, don't make an unnecessary query
            const templates = settings.secrets.datadog
                ? await global.db
                      .collection<delTemplate>("templates")
                      .estimatedDocumentCount()
                : 0;
            websiteGauge("templateCount", templates);
            break;
        case "user":
            const users = await global.db
                .collection<delUser>("users")
                .estimatedDocumentCount();
            websiteGauge("userCount", users);
            break;
    }
}

export async function postTodaysGrowth() {
    const todaysGrowth: botsAddedToday | null = await global.db
        .collection<botsAddedToday>("webOptions")
        .findOne({ _id: "todaysGrowth" });
    if (!todaysGrowth)
        return await global.db.collection<any>("webOptions").insertOne({
            _id: "todaysGrowth",
            count: 0,
            lastPosted: Date.now()
        });

    const date = moment().diff(moment(todaysGrowth.lastPosted), "days");

    if (date >= 1) {
        websiteGauge("addedBotsToday", todaysGrowth.count);

        await global.db.collection("webOptions").updateOne(
            { _id: "todaysGrowth" },
            {
                $set: {
                    count: 0,
                    lastPosted: Date.now()
                }
            }
        );
    } else return;
}

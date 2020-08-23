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

import * as functions from "../Function/main";
import { delBot, delServer, delTemplate } from "../../../@types/del"

export async function getFeaturedBots(): Promise<delBot[]> {
    const bots = await global.redis?.get("featured_bots");
    return JSON.parse(bots);
}

export async function getFeaturedServers(): Promise<delServer[]> {
    const servers = await global.redis?.get("featured_servers");
    return JSON.parse(servers);
}

export async function getFeaturedTemplates(): Promise<delTemplate[]> {
    const templates = await global.redis?.get("featured_templates");
    return JSON.parse(templates);
}

export async function updateFeaturedBots() {
    const statuses = await global.redis?.hgetall("statuses");
    const bots = functions.shuffleArray(
        ((await global.db
            .collection("bots")
            .find()
            .toArray()) as delBot[]).filter(
            ({ _id, status }) =>
                status.approved &&
                !status.siteBot &&
                !status.archived &&
                statuses[_id] &&
                statuses[_id] !== "offline"
        )
    ).slice(0, 6);
    await global.redis?.set("featured_bots", JSON.stringify(bots));
}

export async function updateFeaturedServers() {
    const servers = functions.shuffleArray(
        (await global.db.collection("servers").find().toArray() as delServer[]).filter(
            ({ status }) => status && !status.reviewRequired
        )
    ).slice(0, 6);
    await global.redis?.set("featured_servers", JSON.stringify(servers));
}

export async function updateFeaturedTemplates() {
    const templates = functions
        .shuffleArray(await global.db.collection("templates").find().toArray() as delTemplate[])
        .slice(0, 6);
    await global.redis?.set("featured_templates", JSON.stringify(templates));
}

setInterval(async () => {
    await updateFeaturedBots();
    await updateFeaturedServers();
    await updateFeaturedTemplates();
}, 900000);

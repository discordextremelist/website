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
    const bots = functions
        .shuffleArray(
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
        )
        .slice(0, 6);

    for (const bot of bots as delBot[]) {
        delete bot.clientID;
        delete bot.prefix;
        delete bot.library;
        delete bot.tags;
        delete bot.serverCount;
        delete bot.shardCount;
        delete bot.token;
        delete bot.flags;
        delete bot.longDesc;
        delete bot.modNotes;
        delete bot.editors;
        delete bot.owner;
        delete bot.votes;
        delete bot.links.support;
        delete bot.links.website;
        delete bot.links.donation;
        delete bot.links.repo;
        delete bot.links.privacyPolicy;
        delete bot.social;
        delete bot.theme;
        delete bot.widgetbot;
        delete bot.status.approved;
    }

    await global.redis?.set("featured_bots", JSON.stringify(bots));
}

export async function updateFeaturedServers() {
    const servers = functions
        .shuffleArray(
            ((await global.db
                .collection("servers")
                .find()
                .toArray()) as delServer[]).filter(
                ({ status }) => status && !status.reviewRequired
            )
        )
        .slice(0, 6);

    for (const server of servers as delServer[]) {
        delete server.inviteCode;
        delete server.longDesc;
        delete server.previewChannel;
        delete server.owner;
        delete server.links.website;
        delete server.links.donation;
        delete server.status;
    }

    await global.redis?.set("featured_servers", JSON.stringify(servers));
}

export async function updateFeaturedTemplates() {
    const templates = functions
        .shuffleArray(
            (await global.db
                .collection("templates")
                .find()
                .toArray()) as delTemplate[]
        )
        .slice(0, 6);

    for (const template of templates as delTemplate[]) {
        delete template.region;
        delete template.locale;
        delete template.afkTimeout;
        delete template.verificationLevel;
        delete template.defaultMessageNotifications;
        delete template.explicitContent;
        delete template.roles;
        delete template.channels;
        delete template.usageCount;
        delete template.longDesc;
        delete template.tags;
        delete template.fromGuild;
        delete template.owner;
        delete template.links.linkToServerPage;
    }

    await global.redis?.set("featured_templates", JSON.stringify(templates));
}

setInterval(async () => {
    await updateFeaturedBots();
    await updateFeaturedServers();
    await updateFeaturedTemplates();
}, 900000);

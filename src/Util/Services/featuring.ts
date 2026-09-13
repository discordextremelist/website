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

import { PresenceUpdateStatus, UserFlags } from "discord.js";
import { shuffleArray } from "../Function/array.ts";

/**
 * `Full` narrowed to `Stripped`'s fields, with the rest still present but
 * optional, so the update functions can `delete` them before caching.
 */
type Strippable<Full, Stripped> = Stripped & {
    [K in Exclude<keyof Full, keyof Stripped>]?: Full[K];
};

type strippableBot = Strippable<delBot, featuredBot> & {
    links: Strippable<delBot["links"], featuredBot["links"]>;
};
type strippableServer = Strippable<delServer, featuredServer> & {
    links: Strippable<delServer["links"], featuredServer["links"]>;
};
type strippableTemplate = Strippable<delTemplate, featuredTemplate> & {
    links: Strippable<delTemplate["links"], featuredTemplate["links"]>;
};

/** A cached featured list, or null until it has been filled after startup. */
async function readFeatured<T>(key: string): Promise<T[] | null> {
    const cached = await global.redis?.get(key);
    return cached === null ? null : JSON.parse(cached);
}

export const getFeaturedBots = () => readFeatured<featuredBot>("featured_bots");
export const getFeaturedSFWBots = () =>
    readFeatured<featuredBot>("featured_sfw_bots");
export const getFeaturedServers = () =>
    readFeatured<featuredServer>("featured_servers");
export const getFeaturedTemplates = () =>
    readFeatured<featuredTemplate>("featured_templates");

/** Drop the fields a featured bot is cached without. */
function stripBot(bot: strippableBot) {
    delete bot.clientID;
    delete bot.prefix;
    delete bot.library;
    delete bot.tags;
    delete bot.serverCount;
    delete bot.shardCount;
    delete bot.token;
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
}

/**
 * Pick up to six listed bots at random for the home page and cache them under
 * `key`: approved and visible, and online, or with nothing to be online with
 * (no bot scope, unknown flags, or HTTP interactions). `sfwOnly` leaves out
 * bots labelled NSFW.
 *
 * `userFlags && UserFlags.BotHTTPInteractions` is true for any bot with
 * flags; the `&` it should be is ISSUES I-15.
 */
async function refreshFeaturedBots(key: string, sfwOnly: boolean) {
    const statuses = (await global.redis?.hgetall("statuses")) as Record<
        string,
        PresenceUpdateStatus
    >;
    const bots: strippableBot[] = shuffleArray(
        (
            (await global.db
                .collection<delBot>("bots")
                .find()
                .toArray()) as delBot[]
        ).filter(
            ({ _id, status, scopes, userFlags, labels }) =>
                status.approved &&
                !status.siteBot &&
                !status.archived &&
                !status.hidden &&
                !status.modHidden &&
                (!sfwOnly || !labels?.nsfw) &&
                ((statuses[_id] &&
                    statuses[_id] !== PresenceUpdateStatus.Offline) ||
                    !scopes?.bot ||
                    userFlags === undefined ||
                    (userFlags && UserFlags.BotHTTPInteractions))
        )
    ).slice(0, 6);

    for (const bot of bots) stripBot(bot);

    await global.redis?.set(key, JSON.stringify(bots));
}

export const updateFeaturedBots = () =>
    refreshFeaturedBots("featured_bots", false);
export const updateFeaturedSFWBots = () =>
    refreshFeaturedBots("featured_sfw_bots", true);

export async function updateFeaturedServers() {
    const servers: strippableServer[] = shuffleArray(
        (
            (await global.db
                .collection<delServer>("servers")
                .find()
                .toArray()) as delServer[]
        ).filter(({ status }) => status && !status.reviewRequired)
    ).slice(0, 6);

    for (const server of servers) {
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
    const templates: strippableTemplate[] = shuffleArray(
        (await global.db
            .collection<delTemplate>("templates")
            .find()
            .toArray()) as delTemplate[]
    ).slice(0, 6);

    for (const template of templates) {
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

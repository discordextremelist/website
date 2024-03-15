/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020 Carolina Mitchell, John Burke, Advaith Jagathesan

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

import express from "express";
import type { Request, Response } from "express";

import settings from "../../settings.json" assert { type: "json" };
import * as featuring from "../Util/Services/featuring.js";
import * as botCache from "../Util/Services/botCaching.js";
import * as serverCache from "../Util/Services/serverCaching.js";
import * as templateCache from "../Util/Services/templateCaching.js";
import * as legalCache from "../Util/Services/legalCaching.js";
import * as discord from "../Util/Services/discord.js";
import { variables } from "../Util/Function/variables.js";
import type { Guild, GuildMember, GuildMemberManager } from "discord.js";

const router = express.Router();

const nickSorter = (a, b) =>
    (a.nick || a.user.username).localeCompare(b.nick || b.user.username);
function sortAll() {
    let members = discord.guilds.main.members as GuildMemberManager;
    if (!members) throw new Error("Fetching members failed!");
    const staff: GuildMember[] = [],
        donators: GuildMember[] = [],
        contributors: GuildMember[] = [];
    for (const item of members.cache.filter((m) => !m.user.bot)) {
        const member = item[1];
        if (
            member.roles.cache.has(settings.roles.admin) ||
            member.roles.cache.has(settings.roles.assistant) ||
            member.roles.cache.has(settings.roles.mod)
        ) {
            const admin = member.roles.cache.has(settings.roles.admin);
            const assistant = member.roles.cache.has(settings.roles.assistant);
            const mod = member.roles.cache.has(settings.roles.mod);
            member.order = admin ? 3 : assistant ? 2 : mod ? 1 : 0;
            member.rank = admin
                ? "admin"
                : assistant
                  ? "assistant"
                  : mod
                    ? "mod"
                    : null;
            const user = discord.bot.users.cache.get(member.id);
            member.avatar = user.avatar;
            member.username = user.username;
            member.discriminator = user.discriminator;
            staff.push(member);
        } else if (
            member.roles.cache.has(settings.roles.booster) ||
            member.roles.cache.has(settings.roles.donator)
        ) {
            const booster = member.roles.cache.has(settings.roles.booster);
            const donator = member.roles.cache.has(settings.roles.donator);
            member.order = booster ? 2 : donator ? 1 : 0;
            member.rank = booster ? "booster" : "donator";
            const user = discord.bot.users.cache.get(member.id);
            member.avatar = user.avatar;
            member.username = user.username;
            member.discriminator = user.discriminator;
            donators.push(member);
        } else if (
            member.roles.cache.has(settings.roles.translators) ||
            member.roles.cache.has(settings.roles.testers)
        ) {
            const translator = member.roles.cache.has(
                settings.roles.translators
            );
            const tester = member.roles.cache.has(settings.roles.testers);
            member.order = translator ? 1 : tester ? 2 : 0;
            member.rank = translator ? "translator" : "tester";
            const user = discord.bot.users.cache.get(member.id);
            member.avatar = user.avatar;
            member.username = user.username;
            member.discriminator = user.discriminator;
            contributors.push(member);
        }
    }
    return {
        staff: staff.sort(nickSorter).sort((a, b) => b.order - a.order),
        donators: donators.sort(nickSorter).sort((a, b) => b.order - a.order),
        contributors: contributors
            .sort(nickSorter)
            .sort((a, b) => a.order - b.order)
    };
}

router.get("/", variables, async (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.home");

    const bots = await featuring.getFeaturedBots();
    const servers = await featuring.getFeaturedServers();
    const templates = await featuring.getFeaturedTemplates();

    res.render("templates/index", {
        title: res.__("common.home"),
        subtitle: "",
        req,
        bots,
        servers,
        templates
    });
});

router.get("/bots", variables, async (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.bots");

    if (!req.query.page) req.query.page = "1";

    let icon = "fa-robot has-text-default";
    let title = res.__("common.bots.discord");
    let subtitle = res.__("common.bots.subtitle");
    let bots: delBot[];
    let pageParam = "?page=";

    if (req.query.tag) {
        pageParam = `?tag=${req.query.tag}&page=`;

        switch ((req.query.tag as string).toLowerCase()) {
            case "slashcommands":
                icon = "fa-slash fa-flip-horizontal has-text-blurple";
                title = res.__("common.bots.title.applicationCommands");
                subtitle = res.__(
                    "common.bots.subtitle.filter.applicationCommands",
                    {
                        a: '<a class="has-text-info" href="https://support.discord.com/hc/en-us/articles/1500000368501-Slash-Commands-FAQ" target="_blank" rel="noopener">',
                        a2: '<a class="has-text-info" href="https://discord.com/developers/docs/interactions/application-commands#user-commands" target="_blank" rel="noopener">',
                        ea: "</a>"
                    }
                );
                bots = (await botCache.getAllBots()).filter(
                    ({ status, scopes }) =>
                        status.approved &&
                        !status.siteBot &&
                        !status.archived &&
                        !status.hidden &&
                        !status.modHidden &&
                        scopes?.slashCommands
                );
                break;
            case "fun":
                icon = "fa-grin-squint-tears has-text-link";
                title = res.__("common.bots.title.fun");
                subtitle = res.__("common.bots.subtitle.filter.fun");
                bots = (await botCache.getAllBots()).filter(
                    ({ status, tags }) =>
                        status.approved &&
                        !status.siteBot &&
                        !status.archived &&
                        !status.hidden &&
                        !status.modHidden &&
                        tags.includes("Fun")
                );
                break;
            case "social":
                icon = "fa-comments-alt has-text-info";
                title = res.__("common.bots.title.social");
                subtitle = res.__("common.bots.subtitle.filter.social");
                bots = (await botCache.getAllBots()).filter(
                    ({ status, tags }) =>
                        status.approved &&
                        !status.siteBot &&
                        !status.archived &&
                        !status.hidden &&
                        !status.modHidden &&
                        tags.includes("Social")
                );
                break;
            case "economy":
                icon = "fa-comments-dollar has-text-success";
                title = res.__("common.bots.title.economy");
                subtitle = res.__("common.bots.subtitle.filter.economy");
                bots = (await botCache.getAllBots()).filter(
                    ({ status, tags }) =>
                        status.approved &&
                        !status.siteBot &&
                        !status.archived &&
                        !status.hidden &&
                        !status.modHidden &&
                        tags.includes("Economy")
                );
                break;
            case "utility":
                icon = "fa-cogs has-text-orange";
                title = res.__("common.bots.title.utility");
                subtitle = res.__("common.bots.subtitle.filter.utility");
                bots = (await botCache.getAllBots()).filter(
                    ({ status, tags }) =>
                        status.approved &&
                        !status.siteBot &&
                        !status.archived &&
                        !status.hidden &&
                        !status.modHidden &&
                        tags.includes("Utility")
                );
                break;
            case "moderation":
                icon = "fa-gavel has-text-danger";
                title = res.__("common.bots.title.moderation");
                subtitle = res.__("common.bots.subtitle.filter.moderation");
                bots = (await botCache.getAllBots()).filter(
                    ({ status, tags }) =>
                        status.approved &&
                        !status.siteBot &&
                        !status.archived &&
                        !status.hidden &&
                        !status.modHidden &&
                        tags.includes("Moderation")
                );
                break;
            case "multipurpose":
                icon = "fa-ball-pile has-text-magenta";
                title = res.__("common.bots.title.multipurpose");
                subtitle = res.__("common.bots.subtitle.filter.multipurpose");
                bots = (await botCache.getAllBots()).filter(
                    ({ status, tags }) =>
                        status.approved &&
                        !status.siteBot &&
                        !status.archived &&
                        !status.hidden &&
                        !status.modHidden &&
                        tags.includes("Multipurpose")
                );
                break;
            case "music":
                icon = "fa-comment-music has-text-pink";
                title = res.__("common.bots.title.music");
                subtitle = res.__("common.bots.subtitle.filter.music");
                bots = (await botCache.getAllBots()).filter(
                    ({ status, tags }) =>
                        status.approved &&
                        !status.siteBot &&
                        !status.archived &&
                        !status.hidden &&
                        !status.modHidden &&
                        tags.includes("Music")
                );
                break;
            default:
                bots = (await botCache.getAllBots()).filter(
                    ({ status }) =>
                        status.approved &&
                        !status.siteBot &&
                        !status.archived &&
                        !status.hidden &&
                        !status.modHidden
                );
        }
    } else
        bots = (await botCache.getAllBots()).filter(
            ({ status }) =>
                status.approved &&
                !status.siteBot &&
                !status.archived &&
                !status.hidden &&
                !status.modHidden
        );

    res.render("templates/bots/index", {
        title,
        subtitle,
        req,
        bots,
        icon: icon,
        pageParam,
        botsPgArr: bots.slice(
            15 * Number(req.query.page) - 15,
            15 * Number(req.query.page)
        ),
        page: req.query.page,
        pages: Math.ceil(bots.length / 15)
    });
});

router.get("/servers", variables, async (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.servers");

    if (!req.query.page) req.query.page = "1";
    // Can't calculate total pages with sliced value - AJ
    const allServers = await serverCache.getAllServers();
    const servers = [...allServers]
        .slice(15 * Number(req.query.page) - 15, 15 * Number(req.query.page))
        .filter(({ _id, status }) => status && !status.reviewRequired);

    res.render("templates/servers/index", {
        title: res.__("common.servers.discord"),
        subtitle: res.__("common.servers.subtitle"),
        req,
        servers,
        serversPgArr: servers,
        page: req.query.page,
        pages: Math.ceil(allServers.length / 15)
    });
});

router.get("/templates", variables, async (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.templates");

    if (!req.query.page) req.query.page = "1";

    const templates = await templateCache.getAllTemplates();

    res.render("templates/serverTemplates/index", {
        title: res.__("common.templates.discord"),
        subtitle: res.__("common.templates.subtitle"),
        req,
        templates,
        templatesPgArr: templates.slice(
            15 * Number(req.query.page) - 15,
            15 * Number(req.query.page)
        ),
        page: req.query.page,
        pages: Math.ceil(templates.length / 15)
    });
});

router.get("/terms", variables, async (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.terms");

    res.render("templates/legal/terms", {
        title: res.__("common.nav.more.terms"),
        subtitle: res.__("common.nav.more.terms.subtitle"),
        req,
        terms: await legalCache.getFile("terms")
    });
});

router.get("/privacy", variables, async (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.privacy");

    res.render("templates/legal/privacy", {
        title: res.__("common.nav.more.privacy"),
        subtitle: res.__("common.nav.more.privacy.subtitle"),
        privacy: await legalCache.getFile("privacy")
    });
});

router.get("/guidelines", variables, (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.guidelines");

    res.render("templates/legal/guidelines", {
        title: res.__("common.nav.more.guidelines"),
        subtitle: res.__("common.nav.more.guidelines.subtitle"),
        req
    });
});

router.get("/widgetbot", variables, (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.widgetbot");

    res.render("templates/widgetbot", {
        title: res.__("common.discord"),
        subtitle: res.__("common.discord.subtitle"),
        req,
        settings
    });
});

router.get("/about", variables, async (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.about");

    const { staff, donators, contributors } = sortAll();
    res.render("templates/about", {
        title: res.__("common.nav.more.about"),
        subtitle: res.__("common.nav.more.about.subtitle"),
        req,
        staff,
        donators,
        contributors
    });
});

export default router;

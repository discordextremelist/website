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

import express from "express";
import { Request, Response } from "express";

import chunk = require("chunk");

import * as settings from "../../settings.json";
import * as featuring from "../Util/Services/featuring";
import * as botCache from "../Util/Services/botCaching";
import * as serverCache from "../Util/Services/serverCaching";
import * as templateCache from "../Util/Services/templateCaching";
import * as discord from "../Util/Services/discord";
import { variables } from "../Util/Function/variables";

const router = express.Router();

const nickSorter = (a, b) =>
    (a.nick || a.user.username).localeCompare(b.nick || b.user.username);
function sortAll() {
    let members = discord.bot.guilds.cache.get(settings.guild.main).members;
    if (!members) throw new Error("Fetching members failed!");
    const staff = [],
        donators = [],
        contributors = [];
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
            member.order = booster ? 1 : donator ? 2 : 0;
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

    const bots = (await botCache.getAllBots()).filter(
        ({ status }) => status.approved && !status.siteBot && !status.archived
    );

    res.render("templates/bots/index", {
        title: res.__("common.bots"),
        subtitle: res.__("common.bots.subtitle"),
        req,
        bots,
        botsPgArr: bots.slice((9 * Number(req.query.page)) - 9, 9 * Number(req.query.page)),
        page: req.query.page,
        pages: Math.ceil(bots.length / 9)
    });
});

router.get("/servers", variables, async (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.servers");

    if (!req.query.page) req.query.page = "1";

    const servers = await serverCache.getAllServers();

    res.render("templates/servers/index", {
        title: res.__("common.servers"),
        subtitle: res.__("common.servers.subtitle"),
        req,
        servers,
        serversPgArr: servers.slice((9 * Number(req.query.page)) - 9, 9 * Number(req.query.page)),
        page: req.query.page,
        pages: Math.ceil(servers.length / 9)
    });
});

router.get("/templates", variables, async (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.templates");

    if (!req.query.page) req.query.page = "1";

    const templates = await templateCache.getAllTemplates();

    res.render("templates/serverTemplates/index", {
        title: res.__("common.templates"),
        subtitle: res.__("common.templates.subtitle"),
        req,
        templates,
        templatesPgArr: templates.slice((9 * Number(req.query.page)) - 9, 9 * Number(req.query.page)),
        page: req.query.page,
        pages: Math.ceil(templates.length / 9)
    });
});

router.get("/terms", variables, (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.terms");

    res.render("templates/legal/terms", {
        title: res.__("common.nav.more.terms"),
        subtitle: res.__("common.nav.more.terms.subtitle"),
        req
    });
});

router.get("/privacy", variables, (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.privacy");

    res.render("templates/legal/privacy", {
        title: res.__("common.nav.more.privacy"),
        subtitle: res.__("common.nav.more.privacy.subtitle"),
        req
    });
});

router.get("/cookies", variables, (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.cookie");

    res.render("templates/legal/cookie", {
        title: res.__("common.nav.more.cookies"),
        subtitle: res.__("common.nav.more.cookies.subtitle"),
        req
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

export = router;

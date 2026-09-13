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

import express from "express";
import type { Request, Response } from "express";

import settings from "../../settings.json" with { type: "json" };
import * as featuring from "../Util/Services/cache/featuring.ts";
import * as legalCache from "../Util/Services/cache/legalCaching.ts";
import * as discord from "../Util/Services/discord/index.ts";
import { variables } from "../Util/Middleware/variables.ts";
import type { GuildMember, GuildMemberManager } from "discord.js";

const router = express.Router();

type NamedMember = { nick?: string | null; user: { username: string } };

const nickSorter = (a: NamedMember, b: NamedMember) =>
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
            // One of the three is set, per the if above.
            member.rank = admin ? "admin" : assistant ? "assistant" : "mod";

            const user = member.user;
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
            const user = member.user;
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
            const user = member.user;
            member.avatar = user.avatar;
            member.username = user.username;
            member.discriminator = user.discriminator;
            contributors.push(member);
        }
    }
    // Every member in these lists had order set above.
    return {
        staff: staff.sort(nickSorter).sort((a, b) => b.order! - a.order!),
        donators: donators.sort(nickSorter).sort((a, b) => b.order! - a.order!),
        contributors: contributors
            .sort(nickSorter)
            .sort((a, b) => a.order! - b.order!)
    };
}

router.get("/", variables, async (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.home");

    let bots: featuredBot[] | null;

    if (req.user?.db?.preferences.hideNSFW) {
        bots = await featuring.getFeaturedSFWBots();
    } else {
        bots = await featuring.getFeaturedBots();
    }

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
        req,
        privacy: await legalCache.getFile("privacy")
    });
});

router.get("/guidelines", variables, async (req: Request, res: Response) => {
    res.locals.premidPageInfo = res.__("premid.guidelines");

    res.render("templates/legal/guidelines", {
        title: res.__("common.nav.more.guidelines"),
        subtitle: res.__("common.nav.more.guidelines.subtitle"),
        req,
        guidelines: await legalCache.getFile("guidelines-" + req.locale)
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

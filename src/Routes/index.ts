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
import { variables } from "../Util/Middleware/variables.ts";
import { aboutPageMembers } from "../Util/Function/web/about.ts";

const router = express.Router();

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

/**
 * The terms, privacy and guidelines pages, showing the cached markdown `file`.
 */
async function renderLegal(
    req: Request,
    res: Response,
    page: "terms" | "privacy" | "guidelines",
    file: string
) {
    res.locals.premidPageInfo = res.__(`premid.${page}`);

    res.render(`templates/legal/${page}`, {
        title: res.__(`common.nav.more.${page}`),
        subtitle: res.__(`common.nav.more.${page}.subtitle`),
        req,
        [page]: await legalCache.getFile(file)
    });
}

router.get("/terms", variables, (req: Request, res: Response) =>
    renderLegal(req, res, "terms", "terms")
);

router.get("/privacy", variables, (req: Request, res: Response) =>
    renderLegal(req, res, "privacy", "privacy")
);

router.get("/guidelines", variables, (req: Request, res: Response) =>
    renderLegal(req, res, "guidelines", "guidelines-" + req.locale)
);

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

    const { staff, donators, contributors } = aboutPageMembers();
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

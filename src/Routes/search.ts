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

import chunk from "chunk";
import path from "path";
import * as ejs from "ejs";
import settings from "../../settings.json" with { type: "json" };

import * as botCache from "../Util/Services/botCaching.ts";
import * as userCache from "../Util/Services/userCaching.ts";
import * as serverCache from "../Util/Services/serverCaching.ts";
import * as templateCache from "../Util/Services/templateCaching.ts";
import { variables } from "../Util/Function/variables.ts";
import type { ParsedQs } from "qs";

const renderPath = path.join(process.cwd(), "views/partials");

const router = express.Router();

router.get("/", variables, (req: Request, res: Response) => {
    let search: string | string[] | ParsedQs | ParsedQs[];
    search = typeof req.query.q === "string" ? req.query.q : "";

    return res.render("templates/search", {
        title: res.__("common.search"),
        subtitle: res.__("common.search.subtitle"),
        req,
        search
    });
});

router.post("/", variables, async (req: Request, res: Response) => {
    let { query, only }: { query: string; only: string[] } = req.body;
    if (!query || typeof query !== "string" || typeof only !== "object")
        return res.status(400).json({
            error: true,
            status: 400,
            message: "Missing body parameter"
        });
    const originalQuery = query;
    query = query.toLowerCase();
    let isStaff = false;
    if (!!only && only.includes("users")) {
        if (req.user && req.user.id) {
            const user: delUser = await global.db
                .collection<delUser>("users")
                .findOne({ _id: req.user.id });
            if (!user.rank.mod)
                return res
                    .status(403)
                    .json({ error: true, status: 403, message: "Forbidden" });
            isStaff = true;
        } else {
            return res
                .status(403)
                .json({ error: true, status: 403, message: "Forbidden" });
        }
    }
    const [users, bots, servers, templates] = await Promise.all([
        isStaff ? await userCache.getAllUsers() : [],
        only.length < 1 || only.includes("bots")
            ? await botCache.getAllBots()
            : [],
        only.length < 1 || only.includes("servers")
            ? await serverCache.getAllServers()
            : [],
        only.length < 1 || only.includes("templates")
            ? await templateCache.getAllTemplates()
            : []
    ]);
    let results = chunk(
        await Promise.all([
            ...users
                .filter(
                    ({ _id, fullUsername }) =>
                        _id === query ||
                        fullUsername.toLowerCase().indexOf(query) >= 0
                )
                .map(async (user) => {
                    return ejs.renderFile(renderPath + "/cards/userCard.ejs", {
                        req,
                        linkPrefix: res.locals.linkPrefix,
                        user,
                        search: true,
                        baseURL: settings.website.url,
                        __: res.locals.__
                    });
                }),
            ...bots
                .filter(
                    ({ _id, name }) =>
                        _id === query || name.toLowerCase().indexOf(query) >= 0
                )
                .filter(
                    ({ status }) =>
                        !status.archived &&
                        status.approved &&
                        !status.siteBot &&
                        !status.hidden &&
                        !status.modHidden
                )
                .map(async (bot) => {
                    return ejs.renderFile(renderPath + "/cards/botCard.ejs", {
                        req,
                        linkPrefix: res.locals.linkPrefix,
                        bot,
                        queue: false,
                        verificationApp: false,
                        search: true,
                        baseURL: settings.website.url,
                        profile: false,
                        __: res.locals.__
                    });
                }),
            ...servers
                .filter(
                    ({ _id, name }) =>
                        _id === query || name.toLowerCase().indexOf(query) >= 0
                )
                .map(async (server) => {
                    return ejs.renderFile(
                        renderPath + "/cards/serverCard.ejs",
                        {
                            req,
                            linkPrefix: res.locals.linkPrefix,
                            server,
                            search: true,
                            baseURL: settings.website.url,
                            profile: false,
                            __: res.locals.__
                        }
                    );
                }),
            ...templates
                .filter(
                    ({ _id, name }) =>
                        _id === query || name.toLowerCase().indexOf(query) >= 0
                )
                .map(async (template) => {
                    return ejs.renderFile(
                        renderPath + "/cards/templateCard.ejs",
                        {
                            req,
                            linkPrefix: res.locals.linkPrefix,
                            template,
                            search: true,
                            baseURL: settings.website.url,
                            profile: false,
                            __: res.locals.__
                        }
                    );
                })
        ]),
        18
    );
    return res.json({
        error: false,
        status: 200,
        data: {
            query: originalQuery,
            pages: results
        }
    });
});

export default router;

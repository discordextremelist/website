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

import type { Request, Response } from "express";
import { renderStatus } from "../Function/main.ts";

export const botExists = async (
    req: Request,
    res: Response,
    next: () => void
) => {
    // TODO: Use redis cache
    // TODO: For the aforementioned to work, I need to confirm all update operations call botCache.updateBot
    const bot = await global.db.collection<delBot>("bots").findOne({
        $or: [{ _id: req.params.id }, { vanityUrl: req.params.id }]
    });

    if (!bot)
        return renderStatus(req, res, 404, res.__("common.error.bot.404"));
    if (bot.status.blacklist)
        return res.status(403).render("status", {
            res,
            title: res.__("common.error"),
            // @ts-ignore
            subtitle: res.__("common.error.bot.blacklist"),
            status: 403,
            type: "Error",
            req
        });
    req.attached.bot = bot;
    next();
};

/**
 * Build a middleware that loads the document named by :id, renders the
 * standard 404 page if it does not exist, and otherwise attaches it to
 * req.attached for the route handler.
 *
 * Put it last in a route's chain, after auth and rank checks, so a request
 * is authorised before the lookup happens.
 */
const exists =
    <T>(
        fetch: (id: string) => Promise<T | null | undefined>,
        notFound: Parameters<Response["__"]>[0],
        attach: (req: Request, doc: T) => void
    ) =>
    async (req: Request, res: Response, next: () => void) => {
        const doc = await fetch(req.params.id);
        if (!doc) return renderStatus(req, res, 404, res.__(notFound));
        attach(req, doc);
        next();
    };

export const serverExists = exists(
    (id) => global.db.collection<delServer>("servers").findOne({ _id: id }),
    "common.error.server.404",
    (req, server) => (req.attached.server = server)
);

export const templateExists = exists(
    (id) => global.db.collection<delTemplate>("templates").findOne({ _id: id }),
    "common.error.template.404",
    (req, template) => (req.attached.template = template)
);

export const userExists = exists(
    (id) => global.db.collection<delUser>("users").findOne({ _id: id }),
    "common.error.user.404",
    (req, user) => (req.attached.user = user)
);

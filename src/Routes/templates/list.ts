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
import { PathRoute } from "../route.ts";
import * as templateCache from "../../Util/Services/cache/templateCaching.ts";
import { variables } from "../../Util/Middleware/variables.ts";
import { pageCount, pageOf } from "../../Util/Function/common/array.ts";

/** The template list. */
export class GetTemplates extends PathRoute<"get"> {
    constructor() {
        super("get", "/", [variables]);
    }

    async handle(req: Request, res: Response) {
        res.locals.premidPageInfo = res.__("premid.templates");

        if (!req.query.page) req.query.page = "1";

        const templates = await templateCache.getAllTemplates();

        res.render("templates/serverTemplates/index", {
            title: res.__("common.templates.discord"),
            subtitle: res.__("common.templates.subtitle"),
            req,
            templates,
            templatesPgArr: pageOf(templates, req.query.page),
            page: req.query.page,
            pages: pageCount(templates.length),
            pageParam: "?page="
        });
    }
}

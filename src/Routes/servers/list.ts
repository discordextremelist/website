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
import * as serverCache from "../../Util/Services/cache/serverCaching.ts";
import { variables } from "../../Util/Middleware/variables.ts";

/** The server list. */
export class GetServers extends PathRoute<"get"> {
    constructor() {
        super("get", "/", [variables]);
    }

    async handle(req: Request, res: Response) {
        res.locals.premidPageInfo = res.__("premid.servers");

        if (!req.query.page) req.query.page = "1";
        // Can't calculate total pages with sliced value - AJ
        const allServers = await serverCache.getAllServers();
        const servers = [...allServers]
            .slice(
                15 * Number(req.query.page) - 15,
                15 * Number(req.query.page)
            )
            .filter(({ status }) => status && !status.reviewRequired);

        res.render("templates/servers/index", {
            title: res.__("common.servers.discord"),
            subtitle: res.__("common.servers.subtitle"),
            req,
            servers,
            serversPgArr: servers,
            page: req.query.page,
            pages: Math.ceil(allServers.length / 15),
            pageParam: "?page="
        });
    }
}

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

import { PathRoute } from "../../route.ts";
import type { Request, Response } from "express";

import settings from "../../../../settings.json" with { type: "json" };

import * as userCache from "../../../Util/Services/userCaching.ts";
import * as serverCache from "../../../Util/Services/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import mdi from "markdown-it";
import entities from "html-entities";
import { renderStatus } from "../../../Util/Function/responses.ts";
import { sanitizeMinimalHtml } from "../../../Util/Function/sanitize.ts";

const md = new mdi();

export class GetServer extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id", [variables]);
    }

    async handle(req: Request, res: Response) {
        res.locals.pageType = {
            server: true,
            bot: false
        };

        let server: delServer | null = await serverCache.getServer(
            req.params.id
        );
        if (!server) {
            server = await global.db
                .collection<delServer>("servers")
                .findOne({ _id: req.params.id });
            if (!server)
                return renderStatus(
                    req,
                    res,
                    404,
                    res.__("common.error.server.404"),
                    { pageType: { server: false, bot: false } }
                );
        }

        let serverOwner: delUser | null = await userCache.getUser(
            server.owner.id
        );
        if (!serverOwner) {
            serverOwner = await global.db
                .collection<delUser>("users")
                .findOne({ _id: server.owner.id });
        }

        res.locals.premidPageInfo = res.__("premid.servers.view", server.name);

        const dirty = entities.decode(md.render(server.longDesc));
        let clean: string;
        clean = sanitizeMinimalHtml(dirty);

        res.render("templates/servers/view", {
            title: `${server.name} | ${res.__("common.servers.discord")}`,
            subtitle: server.shortDesc,
            server,
            longDesc: clean,
            serverOwner,
            webUrl: settings.website.url,
            req
        });
    }
}

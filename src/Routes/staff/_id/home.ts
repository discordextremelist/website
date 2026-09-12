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
import * as permission from "../../../Util/Function/permissions.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";
import * as serverCache from "../../../Util/Services/serverCaching.ts";
import * as templateCache from "../../../Util/Services/templateCaching.ts";
import * as userCache from "../../../Util/Services/userCaching.ts";
import { variables } from "../../../Util/Function/variables.ts";

export class StaffHome extends PathRoute<"get"> {
    constructor() {
        super("get", "/", [variables, permission.mod]);
    }

    async handle(req: Request, res: Response) {
        const bots = await botCache.getAllBots();
        const users = await userCache.getAllUsers();
        const servers = await serverCache.getAllServers();
        const templates = await templateCache.getAllTemplates();

        res.locals.premidPageInfo = res.__("premid.staff.home");

        res.render("templates/staff/index", {
            title: res.__("common.nav.me.staffPanel"),
            subtitle: res.__("common.nav.me.staffPanel.subtitle"),
            user: req.user,
            req,
            siteStats: {
                botCount: bots.length,
                serverCount: servers.length,
                userCount: users.length,
                templateCount: templates.length,
                unapprovedBots: bots.filter(
                    (b) => !b.status.approved && !b.status.archived
                ).length
            }
        });
    }
}

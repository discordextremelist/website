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
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as functions from "../../../Util/Function/main.ts";
import * as userCache from "../../../Util/Services/userCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";

export class StaffManager extends PathRoute<"get"> {
    constructor() {
        super("get", "/staff-manager", [variables, permission.assistant]);
    }

    async handle(req: Request, res: Response) {
        const users: delUser[] = await global.db
            .collection<delUser>("users")
            .find({
                $or: [
                    { "rank.admin": true },
                    { "rank.assistant": true },
                    { "rank.mod": true }
                ]
            })
            .toArray();

        res.locals.premidPageInfo = res.__("premid.staff.staffManager");
        for (const user of users) {
            for (const warning of user.staffTracking.punishments.warnings) {
                let executor = await userCache.getUser(warning.executor);
                if (!executor) {
                    executor = await global.db
                        .collection<delUser>("users")
                        .findOne({ _id: warning.executor });
                }

                warning.executorName = executor.fullUsername;
            }

            for (const strike of user.staffTracking.punishments.strikes) {
                let executor = await userCache.getUser(strike.executor);
                if (!executor) {
                    executor = await global.db
                        .collection<delUser>("users")
                        .findOne({ _id: strike.executor });
                }

                strike.executorName = executor.fullUsername;
            }
        }

        res.render("templates/staff/manager", {
            title: res.__("page.staff.manager"),
            subtitle: res.__("page.staff.manager.subtitle"),
            req,
            admin: users.filter(({ rank }) => rank.admin),
            assistant: users.filter(
                ({ rank }) => rank.assistant && !rank.admin
            ),
            mod: users.filter(
                ({ rank }) => rank.mod && !rank.assistant && !rank.admin
            ),
            functions,
            userCache
        });
    }
}

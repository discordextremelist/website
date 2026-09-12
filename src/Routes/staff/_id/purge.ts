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
import * as userCache from "../../../Util/Services/userCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";

let cutoff = new Date(2025, 0, 1); // 01/01/2025
const ranks: (keyof delUser["rank"])[] = [
    "covid",
    "mod",
    "premium",
    "assistant",
    "translator",
    "admin",
    "tester"
];

export class GetPurge extends PathRoute<"get"> {
    constructor() {
        super("get", "/purge", [variables, permission.auth, permission.admin]);
    }

    async handle(req: Request, res: Response) {
        res.render("templates/staff/purge", {
            title: "User purge",
            subtitle: "User purge",
            user: req.user,
            req,
            usersPurged: 0
        });
    }
}

export class PostPurge extends PathRoute<"post"> {
    constructor() {
        super("post", "/purge", [variables, permission.auth, permission.admin]);
    }

    async handle(req: Request, res: Response) {
        let purgeCounter = 0;
        for (const user of (await userCache.getAllUsers()).slice(0, 5000)) {
            if (user.auth?.expires) {
                let date = new Date(user.auth.expires);
                console.log(date < cutoff);
                if (date < cutoff) {
                    // Constraint 1: Less than cutoff date
                    const userBotsData: delBot[] = await global.db
                        .collection<delBot>("bots")
                        .find({ "owner.id": user._id })
                        .toArray();
                    const userServersData: delServer[] = await global.db
                        .collection<delServer>("servers")
                        .find({ "owner.id": user._id })
                        .toArray();
                    const userTemplatesData: delTemplate[] = await global.db
                        .collection<delTemplate>("templates")
                        .find({ "owner.id": user._id })
                        .toArray();
                    if (
                        userBotsData.length < 1 &&
                        userServersData.length < 1 &&
                        userTemplatesData.length < 1
                    ) {
                        // Constraint 2: Delete only if no bots, templates, servers
                        const hasNoRanks = ranks.every(
                            (r) => user.rank[r] === false
                        );
                        if (hasNoRanks) {
                            // Constraint 3: No roles
                            await global.db
                                .collection<delUser>("users")
                                .deleteOne({ _id: user._id });
                            await userCache.deleteUser(user._id);
                            purgeCounter++;
                        }
                    }
                }
            }
        }
        console.log(purgeCounter);
        return res.render("templates/staff/purge", {
            title: "User purge",
            subtitle: "User purge",
            user: req.user,
            req,
            usersPurged: purgeCounter
        });
    }
}

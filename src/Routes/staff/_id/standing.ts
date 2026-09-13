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

import { AuthedPathRoute } from "../../route.ts";
import type { Response } from "express";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as functions from "../../../Util/Function/main.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import type { Nullable } from "../../../Util/Function/types.ts";
import { userExists } from "../../../Util/Middleware/checks.ts";

export class GetStanding extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/staff-manager/standing/:id", [
            variables,
            permission.assistant,
            userExists,
            permission.staffHierarchy
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const user: Nullable<delUser> = req.attached.user!;

        res.locals.premidPageInfo = res.__(
            "premid.staff.staffManager.modifyStanding",
            user.fullUsername
        );

        res.render("templates/staff/staffManagement/standing", {
            title: res.__("page.staff.manager.setStanding"),
            subtitle: res.__(
                "page.staff.manager.setStanding.subtitle",
                user.fullUsername
            ),
            req,
            user,
            standings: [
                {
                    _id: "Unmeasured",
                    display: res.__("page.staff.manager.unmeasured.emoji")
                },
                {
                    _id: "Good",
                    display: res.__("page.staff.manager.good.emoji")
                },
                {
                    _id: "Moderate",
                    display: res.__("page.staff.manager.moderate.emoji")
                },
                {
                    _id: "Moderate-Bad",
                    display: res.__("page.staff.manager.moderateBad.emoji")
                },
                {
                    _id: "Bad",
                    display: res.__("page.staff.manager.bad.emoji")
                }
            ],
            functions
        });
    }
}

export class PostStanding extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/staff-manager/standing/:id", [
            variables,
            permission.assistant,
            userExists,
            permission.staffHierarchy
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const user: Nullable<delUser> = req.attached.user!;

        let allowedStandings = [
            "Unmeasured",
            "Good",
            "Moderate",
            "Moderate-Bad",
            "Bad"
        ];
        let standing = req.body.standing;

        if (!allowedStandings.includes(standing)) {
            standing = "Unmeasured";
        }

        await global.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.details.standing": standing
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "MODIFY_STANDING",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    standing: user.staffTracking.details.standing
                },
                new: {
                    standing: standing
                }
            }
        });

        res.redirect("/staff/staff-manager");
    }
}

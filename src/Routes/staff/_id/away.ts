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
import { variables } from "../../../Util/Middleware/variables.ts";
import type { Nullable } from "../../../Util/Function/types.ts";
import { checkRoleHierarchyStaff } from "../../../Util/Function/main.ts";
import { renderStatus } from "../../../Util/Function/main.ts";

export class GetAway extends PathRoute<"get"> {
    constructor() {
        super("get", "/staff-manager/away/:id", [
            variables,
            permission.assistant
        ]);
    }

    async handle(req: Request, res: Response) {
        const user: Nullable<delUser> = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return renderStatus(req, res, 404, res.__("common.error.user.404"));

        if (
            user.rank.assistant === true &&
            checkRoleHierarchyStaff(req.user.db, "assistant", true)
        )
            return renderStatus(
                req,
                res,
                403,
                res.__("page.users.modifyRank.assistantHierachyBlock.0")
            );

        res.render("templates/staff/staffManagement/away", {
            title: res.__("page.staff.manager.setAway"),
            subtitle: res.__(
                "page.staff.manager.setAway.subtitle",
                user.fullUsername
            ),
            req,
            user
        });
    }
}

export class PostAway extends PathRoute<"post"> {
    constructor() {
        super("post", "/staff-manager/away/:id", [
            variables,
            permission.assistant
        ]);
    }

    async handle(req: Request, res: Response) {
        const user: delUser | undefined = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return renderStatus(req, res, 404, res.__("common.error.user.404"));

        if (
            user.rank.assistant === true &&
            checkRoleHierarchyStaff(req.user.db, "assistant", true)
        )
            return renderStatus(
                req,
                res,
                403,
                res.__("page.users.modifyRank.assistantHierachyBlock.0")
            );

        res.locals.premidPageInfo = res.__(
            "premid.staff.staffManager.updateAway",
            user.fullUsername
        );

        await global.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.details.away.status": true,
                    "staffTracking.details.away.message": req.body.reason
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "UPDATE_AWAY",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    away: {
                        status: user.staffTracking.details.away.status,
                        message: user.staffTracking.details.away.message
                    }
                },
                new: {
                    away: {
                        status: true,
                        message: req.body.reason
                    }
                }
            }
        });

        res.redirect("/staff/staff-manager");
    }
}

export class ResetAway extends PathRoute<"get"> {
    constructor() {
        super("get", "/staff-manager/away/:id/reset", [
            variables,
            permission.assistant
        ]);
    }

    async handle(req: Request, res: Response) {
        const user: delUser | undefined = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return renderStatus(req, res, 404, res.__("common.error.user.404"));

        if (
            user.rank.assistant === true &&
            checkRoleHierarchyStaff(req.user.db, "assistant", true)
        )
            return renderStatus(
                req,
                res,
                403,
                res.__("page.users.modifyRank.assistantHierachyBlock.0")
            );

        await global.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.details.away.status": false,
                    "staffTracking.details.away.message": ""
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "RESET_AWAY",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    away: {
                        status: user.staffTracking.details.away.status,
                        message: user.staffTracking.details.away.message
                    }
                },
                new: {
                    away: {
                        status: false,
                        message: ""
                    }
                }
            }
        });

        res.redirect("/staff/staff-manager");
    }
}

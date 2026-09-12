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
import { variables } from "../../../Util/Function/variables.ts";
import type { Nullable } from "../../../Util/Function/types.ts";
import { checkRoleHierarchyStaff } from "../../../Util/Function/main.ts";

export class GetWarn extends PathRoute<"get"> {
    constructor() {
        super("get", "/staff-manager/punish/warn/:id", [
            variables,
            permission.assistant
        ]);
    }

    async handle(req: Request, res: Response) {
        const user: Nullable<delUser> = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
            checkRoleHierarchyStaff(req.user.db, "assistant", true)
        )
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__(
                    "page.users.modifyRank.assistantHierachyBlock.0"
                ),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__(
            "premid.staff.staffManager.warn",
            user.fullUsername
        );

        res.render("templates/staff/staffManagement/warn", {
            title: res.__("page.staff.manager.warn"),
            subtitle: res.__(
                "page.staff.manager.warn.subtitle",
                user.fullUsername
            ),
            req,
            user
        });
    }
}

export class PostWarn extends PathRoute<"post"> {
    constructor() {
        super("post", "/staff-manager/punish/warn/:id", [
            variables,
            permission.assistant
        ]);
    }

    async handle(req: Request, res: Response) {
        const user: Nullable<delUser> = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
            checkRoleHierarchyStaff(req.user.db, "assistant", true)
        )
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__(
                    "page.users.modifyRank.assistantHierachyBlock.0"
                ),
                req,
                type: "Error"
            });

        const warnings = user.staffTracking.punishments.warnings;
        warnings.push({
            executor: req.user.id,
            reason: req.body.reason,
            date: Date.now()
        });

        await global.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.punishments.warnings": warnings
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "ADD_WARNING",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                new: {
                    executor: req.user.id,
                    reason: req.body.reason,
                    date: Date.now()
                }
            }
        });

        res.redirect("/staff/staff-manager");
    }
}

export class GetStrike extends PathRoute<"get"> {
    constructor() {
        super("get", "/staff-manager/punish/strike/:id", [
            variables,
            permission.assistant
        ]);
    }

    async handle(req: Request, res: Response) {
        const user: Nullable<delUser> = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
            req.user.db.rank.admin === false &&
            req.user.db.rank.assistant === true
        )
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__(
                    "page.users.modifyRank.assistantHierachyBlock.0"
                ),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__(
            "premid.staff.staffManager.strike",
            user.fullUsername
        );

        res.render("templates/staff/staffManagement/strike", {
            title: res.__("page.staff.manager.strike"),
            subtitle: res.__(
                "page.staff.manager.strike.subtitle",
                user.fullUsername
            ),
            req,
            user
        });
    }
}

export class PostStrike extends PathRoute<"post"> {
    constructor() {
        super("post", "/staff-manager/punish/strike/:id", [
            variables,
            permission.assistant
        ]);
    }

    async handle(req: Request, res: Response) {
        const user: Nullable<delUser> = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
            checkRoleHierarchyStaff(req.user.db, "assistant", true)
        )
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__(
                    "page.users.modifyRank.assistantHierachyBlock.0"
                ),
                req,
                type: "Error"
            });

        const strikes = user.staffTracking.punishments.strikes;
        strikes.push({
            executor: req.user.id,
            reason: req.body.reason,
            date: Date.now()
        });

        await global.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.punishments.strikes": strikes
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "ADD_STRIKE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                new: {
                    executor: req.user.id,
                    reason: req.body.reason,
                    date: Date.now()
                }
            }
        });

        res.redirect("/staff/staff-manager");
    }
}

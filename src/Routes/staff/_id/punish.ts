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
import { variables } from "../../../Util/Middleware/variables.ts";
import { userExists } from "../../../Util/Middleware/checks.ts";

// What differs between a warning and a strike.
const PUNISHMENTS = {
    warn: {
        list: "warnings",
        audit: "ADD_WARNING",
        template: "templates/staff/staffManagement/warn",
        premid: "premid.staff.staffManager.warn",
        title: "page.staff.manager.warn",
        subtitle: "page.staff.manager.warn.subtitle"
    },
    strike: {
        list: "strikes",
        audit: "ADD_STRIKE",
        template: "templates/staff/staffManagement/strike",
        premid: "premid.staff.staffManager.strike",
        title: "page.staff.manager.strike",
        subtitle: "page.staff.manager.strike.subtitle"
    }
} as const;

type Punishment = keyof typeof PUNISHMENTS;

/** The warn or strike form for the staff member userExists attached. */
function renderPunishmentForm(
    req: AuthedRequest,
    res: Response,
    kind: Punishment
) {
    const user = req.attached.user!;
    const punishment = PUNISHMENTS[kind];

    res.locals.premidPageInfo = res.__(punishment.premid, user.fullUsername);

    res.render(punishment.template, {
        title: res.__(punishment.title),
        subtitle: res.__(punishment.subtitle, user.fullUsername),
        req,
        user
    });
}

/**
 * Add the posted warning or strike to the staff member's record, audit it,
 * and go back to the staff manager.
 */
async function addPunishment(
    req: AuthedRequest,
    res: Response,
    kind: Punishment
) {
    const user = req.attached.user!;
    const punishment = PUNISHMENTS[kind];

    const list = user.staffTracking.punishments[punishment.list];
    list.push({
        executor: req.user.id,
        reason: req.body.reason,
        date: Date.now()
    });

    await global.db.collection("users").updateOne(
        { _id: req.params.id },
        {
            $set: {
                [`staffTracking.punishments.${punishment.list}`]: list
            }
        }
    );

    await global.db.collection("audit").insertOne({
        type: punishment.audit,
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

export class GetWarn extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/staff-manager/punish/warn/:id", [
            variables,
            permission.assistant,
            userExists,
            permission.staffHierarchy
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        renderPunishmentForm(req, res, "warn");
    }
}

export class PostWarn extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/staff-manager/punish/warn/:id", [
            variables,
            permission.assistant,
            userExists,
            permission.staffHierarchy
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        await addPunishment(req, res, "warn");
    }
}

export class GetStrike extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/staff-manager/punish/strike/:id", [
            variables,
            permission.assistant,
            userExists,
            permission.staffHierarchy
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        renderPunishmentForm(req, res, "strike");
    }
}

export class PostStrike extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/staff-manager/punish/strike/:id", [
            variables,
            permission.assistant,
            userExists,
            permission.staffHierarchy
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        await addPunishment(req, res, "strike");
    }
}

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
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as userCache from "../../../Util/Services/cache/userCaching.ts";
import { renderStatus } from "../../../Util/Function/web/responses.ts";
import { userExists } from "../../../Util/Middleware/checks.ts";

export class GetUserRank extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/rank", [
            variables,
            permission.auth,
            permission.assistant,
            userExists,
            permission.staffHierarchy
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const targetUser: delUser = req.attached.user!;

        res.locals.premidPageInfo = res.__(
            "premid.user.modifyRank",
            targetUser.fullUsername
        );

        res.render("templates/users/staffActions/modifyRank", {
            title: res.__("page.users.modifyRank"),
            subtitle: res.__(
                "page.users.modifyRank.subtitle",
                targetUser.fullUsername
            ),
            user: req.user,
            req: req,
            targetUser: targetUser
        });
    }
}

export class PostUserRank extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/rank", [
            variables,
            permission.auth,
            permission.assistant,
            userExists,
            permission.staffHierarchy
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const targetUser: delUser = req.attached.user!;

        let premium = false;
        let tester = false;
        let translator = false;
        let covid = false;
        let mod = false;
        let assistant = false;
        let admin = false;

        if (req.body.tester === "on") tester = true;
        if (req.body.translator === "on") translator = true;
        if (req.body.premium === "on") premium = true;
        if (req.body.covid === "on") covid = true;

        if (req.body.rank === "mod") mod = true;

        if (
            (req.user.db.rank.admin === false &&
                req.body.rank === "assistant") ||
            (req.user.db.rank.admin === false && req.body.rank === "admin")
        ) {
            return renderStatus(
                req,
                res,
                403,
                res.__("page.users.modifyRank.assistantHierachyBlock.1")
            );
        } else {
            if (req.body.rank === "assistant") {
                mod = true;
                assistant = true;
            } else if (req.body.rank === "admin") {
                mod = true;
                assistant = true;
                admin = true;
            }
        }

        await global.db.collection("users").updateOne(
            { _id: targetUser._id },
            {
                $set: {
                    rank: {
                        admin: admin,
                        assistant: assistant,
                        mod: mod,
                        translator: translator,
                        tester: tester,
                        premium: premium,
                        covid: covid
                    }
                }
            }
        );

        await userCache.updateUser(targetUser._id);

        await global.db.collection("audit").insertOne({
            type: "MODIFY_RANK",
            executor: req.user.id,
            target: targetUser._id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    rank: {
                        admin: targetUser.rank.admin,
                        assistant: targetUser.rank.assistant,
                        mod: targetUser.rank.mod,
                        translator: targetUser.rank.translator,
                        tester: targetUser.rank.tester,
                        premium: targetUser.rank.premium,
                        covid: targetUser.rank.covid
                    }
                },
                new: {
                    rank: {
                        admin: admin,
                        assistant: assistant,
                        mod: mod,
                        translator: translator,
                        tester: tester,
                        premium: premium,
                        covid: covid
                    }
                }
            }
        });

        res.redirect(`/users/${targetUser._id}`);
    }
}

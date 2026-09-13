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
import * as userCache from "../../../Util/Services/userCaching.ts";

export class UserSrc extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/src", [
            variables,
            permission.auth,
            permission.admin,
            permission.adminToken
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        if (req.params.id === "@me") {
            if (!req.user) return res.redirect("/auth/login");
            req.params.id = req.user.id;
        }

        const cache: delUser | null = await userCache.getUser(req.params.id);

        const db: delUser | null = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.params.id });

        return res.json({ cache: cache, db: db });
    }
}

export class SessionSrc extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/@me/src/session", [
            variables,
            permission.auth,
            permission.admin,
            permission.adminToken
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        return res.json(req.user);
    }
}

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
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as userCache from "../../../Util/Services/userCaching.ts";
import * as tokenManager from "../../../Util/Services/adminTokenManager.ts";

export class UserSrc extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/src", [
            variables,
            permission.auth,
            permission.admin
        ]);
    }

    async handle(req: Request, res: Response) {
        if (req.params.id === "@me") {
            if (!req.user) return res.redirect("/auth/login");
            req.params.id = req.user.id;
        }

        if (!req.query.token) return res.json({});
        const tokenCheck = await tokenManager.verifyToken(
            req.user.id,
            req.query.token as string
        );
        if (tokenCheck === false) return res.json({});

        const cache: delUser | undefined = await userCache.getUser(
            req.params.id
        );

        const db: delUser | undefined = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.params.id });

        return res.json({ cache: cache, db: db });
    }
}

export class SessionSrc extends PathRoute<"get"> {
    constructor() {
        super("get", "/@me/src/session", [
            variables,
            permission.auth,
            permission.admin
        ]);
    }

    async handle(req: Request, res: Response) {
        if (!req.query.token) return res.json({});
        const tokenCheck = await tokenManager.verifyToken(
            req.user.id,
            req.query.token as string
        );
        if (tokenCheck === false) return res.json({});

        return res.json(req.user);
    }
}

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
import { variables } from "../../../Util/Function/variables.ts";
import * as tokenManager from "../../../Util/Services/adminTokenManager.ts";

export class UploadBots extends PathRoute<"get"> {
    constructor() {
        super("get", "/upload_bots", [
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

        await botCache.uploadBots();

        return res.sendStatus(200);
    }
}

export class UploadServers extends PathRoute<"get"> {
    constructor() {
        super("get", "/upload_servers", [
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

        await serverCache.uploadServers();

        return res.sendStatus(200);
    }
}

export class UploadTemplates extends PathRoute<"get"> {
    constructor() {
        super("get", "/upload_templates", [
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

        await templateCache.uploadTemplates();

        return res.sendStatus(200);
    }
}

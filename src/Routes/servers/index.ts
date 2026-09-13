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

import express, { type Router } from "express";
import * as permission from "../../Util/Middleware/permissions.ts";
import { reasonType } from "../../Util/Function/audit.ts";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import { GetSubmitServer, PostSubmitServer } from "./_id/submit.ts";
import { GetServer } from "./_id/get.ts";
import { ServerSrc, ReportServer } from "./_id/src.ts";
import { GetEditServer, PostEditServer } from "./_id/edit.ts";
import { GetDeclineServer, PostDeclineServer } from "./_id/decline.ts";
import { ApproveServer } from "./_id/approve.ts";
import { DeleteServer } from "./_id/delete.ts";
import { GetRemoveServer, PostRemoveServer } from "./_id/remove.ts";
import { SyncServer } from "./_id/sync.ts";
import { communityTags } from "../../Util/Function/serverListing.ts";

export let reviewRequired = false; // Needs to be outside the functions, or it cannot be referenced outside x function - AJ

export function serverType(bodyType: string): number {
    return reasonType(bodyType, 5);
}

export function tagHandler(
    req: express.Request<ParamsDictionary, any, any, ParsedQs>,
    server: false | delServer
) {
    let tags: string[] = communityTags(req.body);

    if (req.body.contCreat === true) tags.push("Content Creation");
    if (req.body.nsfw === true) tags.push("NSFW");

    if (req.body.lgbt === true) {
        tags.push("LGBT");
        if (server) {
            if (!server.tags.includes("LGBT")) reviewRequired = true;
            if (
                server.tags.includes("LGBT") &&
                server.status.reviewRequired === true
            )
                reviewRequired = true;
        } else reviewRequired = true;
    }

    return tags;
}

export const initServerRoutes = (): Router => {
    const router = express.Router();
    new GetSubmitServer().register(router);
    new PostSubmitServer().register(router);
    new GetServer().register(router);
    router.get("/:id/exists", permission.auth, async (req, res) => {
        res.type("text").send(
            String(await global.redis?.hexists("servers", req.params.id))
        );
    });
    new ServerSrc().register(router);
    new ReportServer().register(router);
    new GetEditServer().register(router);
    new PostEditServer().register(router);
    new GetDeclineServer().register(router);
    new PostDeclineServer().register(router);
    new ApproveServer().register(router);
    new DeleteServer().register(router);
    new GetRemoveServer().register(router);
    new PostRemoveServer().register(router);
    new SyncServer().register(router);
    return router;
};

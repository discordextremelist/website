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
import { GetSubmitServer, PostSubmitServer } from "./submit.ts";
import { GetServer } from "./_id/get.ts";
import { ServerSrc, ReportServer } from "./_id/src.ts";
import { GetEditServer, PostEditServer } from "./_id/edit.ts";
import { GetDeclineServer, PostDeclineServer } from "./_id/decline.ts";
import { ApproveServer } from "./_id/approve.ts";
import { DeleteServer } from "./_id/delete.ts";
import { GetRemoveServer, PostRemoveServer } from "./_id/remove.ts";
import { SyncServer } from "./_id/sync.ts";
import { GetServers } from "./list.ts";
import { sendExists } from "../../Util/Function/web/responses.ts";

export const initServerRoutes = (): Router => {
    const router = express.Router();
    new GetServers().register(router);
    new GetSubmitServer().register(router);
    new PostSubmitServer().register(router);
    new GetServer().register(router);
    router.get("/:id/exists", permission.auth, async (req, res) =>
        sendExists(res, "servers", req.params.id)
    );
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

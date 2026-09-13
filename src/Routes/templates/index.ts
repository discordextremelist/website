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
import { GetSubmitTemplate, PostSubmitTemplate } from "./submit.ts";
import { GetTemplate } from "./_id/get.ts";
import { TemplateSrc, ReportTemplate } from "./_id/src.ts";
import { GetEditTemplate, PostEditTemplate } from "./_id/edit.ts";
import { DeleteTemplate } from "./_id/delete.ts";
import { GetRemoveTemplate, PostRemoveTemplate } from "./_id/remove.ts";
import { SyncTemplate } from "./_id/sync.ts";
import { GetTemplates } from "./list.ts";

export const initTemplateRoutes = (): Router => {
    const router = express.Router();
    new GetTemplates().register(router);
    new GetSubmitTemplate().register(router);
    new PostSubmitTemplate().register(router);
    new GetTemplate().register(router);
    router.get("/:id/exists", permission.auth, async (req, res) => {
        res.type("text").send(
            String(await global.redis?.hexists("templates", req.params.id))
        );
    });
    new TemplateSrc().register(router);
    new ReportTemplate().register(router);
    new GetEditTemplate().register(router);
    new PostEditTemplate().register(router);
    new DeleteTemplate().register(router);
    new GetRemoveTemplate().register(router);
    new PostRemoveTemplate().register(router);
    new SyncTemplate().register(router);
    return router;
};

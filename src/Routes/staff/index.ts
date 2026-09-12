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
import { StaffHome } from "./_id/home.ts";
import { BotQueue, ServerQueue, InviteQueue } from "./_id/queues.ts";
import { AuditLog } from "./_id/audit.ts";
import { StaffManager } from "./_id/staff_manager.ts";
import { GetAway, PostAway, ResetAway } from "./_id/away.ts";
import { GetStanding, PostStanding } from "./_id/standing.ts";
import { GetWarn, PostWarn, GetStrike, PostStrike } from "./_id/punish.ts";
import { GetAnnounce, PostAnnounce, ResetAnnounce } from "./_id/announce.ts";
import { MaskUser } from "./_id/mask.ts";
import { UploadBots, UploadServers, UploadTemplates } from "./_id/upload.ts";
import { GetPurge, PostPurge } from "./_id/purge.ts";

export const initStaffRoutes = (): Router => {
    const router = express.Router();
    new StaffHome().register(router);
    new BotQueue().register(router);
    new ServerQueue().register(router);
    new InviteQueue().register(router);
    new AuditLog().register(router);
    new StaffManager().register(router);
    new GetAway().register(router);
    new PostAway().register(router);
    new ResetAway().register(router);
    new GetStanding().register(router);
    new PostStanding().register(router);
    new GetWarn().register(router);
    new PostWarn().register(router);
    new GetStrike().register(router);
    new PostStrike().register(router);
    new GetAnnounce().register(router);
    new PostAnnounce().register(router);
    new ResetAnnounce().register(router);
    new MaskUser().register(router);
    new UploadBots().register(router);
    new UploadServers().register(router);
    new UploadTemplates().register(router);
    new GetPurge().register(router);
    new PostPurge().register(router);
    return router;
};

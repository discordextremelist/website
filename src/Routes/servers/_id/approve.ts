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
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord/index.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import { escapeFormatting } from "../../../Util/Function/common/format.ts";
import { renderStatus } from "../../../Util/Function/web/responses.ts";
import * as serverCache from "../../../Util/Services/cache/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import { serverExists } from "../../../Util/Middleware/checks.ts";
import { logListingEvent } from "../../../Util/Function/listings/websiteLog.ts";
import { recordStaffAction } from "../../../Util/Function/staff/staffActions.ts";
import { recordAudit } from "../../../Util/Function/staff/recordAudit.ts";

export class ApproveServer extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/approve", [
            variables,
            permission.auth,
            permission.mod,
            serverExists
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const server: delServer | undefined = req.attached.server!;

        if (!server.status || !server.status.reviewRequired)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.server.notInQueue")
            );

        await global.db.collection("servers").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.reviewRequired": false
                }
            }
        );

        await recordStaffAction(req.user.id, "Servers", "approved");

        await recordAudit({
            type: "APPROVE_SERVER",
            executor: req.user.id,
            target: req.params.id,
            reason: req.body.reason || "None specified."
        });

        await serverCache.updateServer(req.params.id);

        logListingEvent(req, "server", "approved", server).catch((e) => {
            console.error(e);
        });

        await discord.messageMember(
            server.owner.id,
            `${settings.emoji.check} **|** Your server **${escapeFormatting(
                server.name
            )}** \`(${
                server._id
            })\` was approved as being listed as an LGBTQ+ community.`
        );

        res.redirect("/staff/server_queue");
    }
}

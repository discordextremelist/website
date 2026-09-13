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
import * as discord from "../../../Util/Services/discord.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import { escapeFormatting } from "../../../Util/Function/format.ts";
import { renderStatus } from "../../../Util/Function/responses.ts";
import * as userCache from "../../../Util/Services/userCaching.ts";
import * as serverCache from "../../../Util/Services/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import { serverExists } from "../../../Util/Middleware/checks.ts";
import { logWebsiteAction } from "../../../Util/Function/websiteLog.ts";

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

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $inc: {
                    "staffTracking.handledServers.allTime.total": 1,
                    "staffTracking.handledServers.allTime.approved": 1,
                    "staffTracking.handledServers.thisWeek.total": 1,
                    "staffTracking.handledServers.thisWeek.approved": 1
                }
            }
        );

        await userCache.updateUser(req.user.id);

        await global.db.collection("audit").insertOne({
            type: "APPROVE_SERVER",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified."
        });

        await serverCache.updateServer(req.params.id);

        logWebsiteAction(
            req,
            settings.emoji.check,
            "approved server",
            server.name,
            server._id,
            {
                suffix: ` to be listed as an LGBTQ+ community.\n<${
                    settings.website.url
                }/servers/${server._id}>`
            }
        ).catch((e) => {
            console.error(e);
        });

        const owner = await discord.getMember(server.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.check
                    } **|** Your server **${escapeFormatting(
                        server.name
                    )}** \`(${
                        server._id
                    })\` was approved as being listed as an LGBTQ+ community.`
                )
                .catch((e) => {
                    console.error(e);
                });

        res.redirect("/staff/server_queue");
    }
}

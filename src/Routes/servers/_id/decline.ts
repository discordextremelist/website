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
import * as permission from "../../../Util/Middleware/permissions.ts";
import { renderStatus } from "../../../Util/Function/web/responses.ts";
import * as serverCache from "../../../Util/Services/cache/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import { serverType } from "../../../Util/Function/staff/audit.ts";
import { serverExists } from "../../../Util/Middleware/checks.ts";
import { logListingEvent } from "../../../Util/Function/listings/websiteLog.ts";
import {
    reasonMissing,
    recordStaffAction
} from "../../../Util/Function/staff/staffActions.ts";
import { recordAudit } from "../../../Util/Function/staff/recordAudit.ts";
import { messageListingOwner } from "../../../Util/Function/listings/ownerMessage.ts";

export class GetDeclineServer extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/decline", [
            variables,
            permission.auth,
            permission.mod,
            serverExists
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const server: delServer | undefined = req.attached.server!;

        res.locals.premidPageInfo = res.__(
            "premid.servers.decline",
            server.name
        );

        if (!server.status || !server.status.reviewRequired)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.server.notInQueue")
            );

        let redirect = `/servers/${server._id}`;

        if (req.query.from && req.query.from === "queue")
            redirect = "/staff/server_queue";

        res.locals.premidPageInfo = res.__(
            "premid.servers.decline",
            server.name
        );

        res.render("templates/servers/staffActions/remove", {
            title: res.__("page.servers.decline.title"),
            icon: "minus",
            subtitle: res.__("page.servers.decline.subtitle", server.name),
            removingServer: server,
            req,
            redirect
        });
    }
}

export class PostDeclineServer extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/decline", [
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

        if (reasonMissing(req, res)) return;

        const tags = new Set(server.tags);
        tags.delete("LGBT");

        await global.db.collection("servers").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    tags: [...tags],
                    "status.reviewRequired": false
                }
            }
        );

        await recordStaffAction(req.user.id, "Servers", "declined");

        const type = serverType(req.body.type);

        await recordAudit({
            type: "DECLINE_SERVER",
            executor: req.user.id,
            target: req.params.id,
            reason: req.body.reason || "None specified.",
            reasonType: type
        });

        await serverCache.updateServer(req.params.id);

        await logListingEvent(req, "server", "declined", server, {
            reason: req.body.reason
        });

        await messageListingOwner(
            server.owner.id,
            "server",
            "declined",
            server,
            { reason: req.body.reason }
        );

        res.redirect("/staff/server_queue");
    }
}

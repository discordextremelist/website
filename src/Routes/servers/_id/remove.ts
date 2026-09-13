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
import * as serverCache from "../../../Util/Services/cache/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import { serverType } from "../index.ts";
import { serverExists } from "../../../Util/Middleware/checks.ts";
import { logListingEvent } from "../../../Util/Function/listings/websiteLog.ts";
import { reasonMissing } from "../../../Util/Function/staff/staffActions.ts";

export class GetRemoveServer extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/remove", [
            variables,
            permission.auth,
            permission.mod,
            serverExists
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const server: delServer | undefined = req.attached.server!;

        res.locals.premidPageInfo = res.__(
            "premid.servers.remove",
            server.name
        );

        res.render("templates/servers/staffActions/remove", {
            title: res.__("page.servers.remove.title"),
            subtitle: res.__("page.servers.remove.subtitle", server.name),
            icon: "trash",
            removingServer: server,
            req
        });
    }
}

export class PostRemoveServer extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/remove", [
            variables,
            permission.auth,
            permission.mod,
            serverExists
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const server: delServer | undefined = req.attached.server!;

        if (reasonMissing(req, res)) return;

        await global.db.collection("servers").deleteOne({ _id: req.params.id });

        const type = serverType(req.body.type);

        await global.db.collection("audit").insertOne({
            type: "REMOVE_SERVER",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            reasonType: type
        });

        await serverCache.deleteServer(req.params.id);

        await logListingEvent(req, "server", "removed", server, {
            reason: req.body.reason
        });

        await discord.messageMember(
            server.owner.id,
            `${settings.emoji.delete} **|** Your server **${escapeFormatting(
                server.name
            )}** \`(${server._id})\` has been removed!\n**Reason:** \`${
                req.body.reason || "None specified."
            }\``
        );

        await discord.postWebMetric("server");

        res.redirect("/servers");
    }
}

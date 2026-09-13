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
import * as serverCache from "../../../Util/Services/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import { serverType } from "../index.ts";
import { serverExists } from "../../../Util/Middleware/checks.ts";
import { logWebsiteAction } from "../../../Util/Function/websiteLog.ts";
import {
    reasonEmbed,
    reasonMissing,
    recordStaffAction
} from "../../../Util/Function/staffActions.ts";

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

        await global.db.collection("audit").insertOne({
            type: "DECLINE_SERVER",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            reasonType: type
        });

        await serverCache.updateServer(req.params.id);

        const embed = reasonEmbed(
            req.body.reason,
            `${settings.website.url}/servers/${server._id}`
        );
        embed.setFooter({
            text: "It will still be shown as a normal server, it was declined from being listed as an LGBTQ+ community."
        });

        await logWebsiteAction(
            req,
            settings.emoji.cross,
            "declined server",
            server.name,
            server._id,
            { embeds: [embed] }
        );

        await discord.messageMember(
            server.owner.id,
            `${settings.emoji.cross} **|** Your server **${escapeFormatting(
                server.name
            )}** \`(${
                server._id
            })\` was declined from being listed as an LGBTQ+ community. It will still appear as a normal server.\n**Reason:** \`${
                req.body.reason || "None specified."
            }\``
        );

        res.redirect("/staff/server_queue");
    }
}

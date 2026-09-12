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
import { EmbedBuilder } from "discord.js";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as functions from "../../../Util/Function/main.ts";
import * as serverCache from "../../../Util/Services/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import { serverType } from "../index.ts";
import { renderStatus } from "../../../Util/Function/main.ts";
import { serverExists } from "../../../Util/Middleware/checks.ts";
import { websiteLogMessage } from "../../../Util/Function/main.ts";

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

        if (!req.body.reason && !req.user.db.rank.admin) {
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.reasonRequired")
            );
        }

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

        const embed = new EmbedBuilder();
        embed.setColor(0x2f3136);
        embed.setTitle("Reason");
        embed.setDescription(req.body.reason);

        await discord.channels.logs.send({
            content: websiteLogMessage(
                req,
                settings.emoji.delete,
                "removed server",
                server.name,
                server._id
            ),
            embeds: [embed]
        });

        const owner = await discord.getMember(server.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.delete
                    } **|** Your server **${functions.escapeFormatting(
                        server.name
                    )}** \`(${server._id})\` has been removed!\n**Reason:** \`${
                        req.body.reason || "None specified."
                    }\``
                )
                .catch((e: string) => {
                    console.error(e);
                });

        await discord.postWebMetric("server");

        res.redirect("/servers");
    }
}

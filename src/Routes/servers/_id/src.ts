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
import { escapeFormatting } from "../../../Util/Function/format.ts";
import * as serverCache from "../../../Util/Services/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";

export class ServerSrc extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/src", [
            variables,
            permission.auth,
            permission.admin,
            permission.adminToken
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        if (req.params.id === "@me") {
            if (!req.user) return res.redirect("/auth/login");
            req.params.id = req.user.id;
        }

        const cache = await serverCache.getServer(req.params.id);
        const db = await global.db
            .collection("servers")
            .findOne({ _id: req.params.id });

        return res.json({ cache: cache, db: db });
    }
}

export class ReportServer extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/report", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const server = await serverCache.getServer(req.params.id);

        if (!server)
            return res.status(404).json({
                error: true,
                status: 404,
                message: res.__("common.error.bot.404")
            });

        if (server.owner.id === req.user.id)
            return res.status(403).json({
                error: true,
                status: 403,
                message: res.__("common.error.report.self")
            });

        try {
            const embed = new EmbedBuilder();
            embed.setColor(0x2f3136);
            embed.setTitle("Server Report");
            embed.setURL(`${settings.website.url}/bots/${server._id}`);
            embed.addFields(
                {
                    name: "Reason",
                    value: req.body.reason ? req.body.reason : "None provided."
                },
                {
                    name: "Additional information",
                    value: req.body.additionalInfo
                        ? req.body.additionalInfo
                        : "None provided."
                }
            );

            await discord.channels.alerts.send({
                content: `${settings.emoji.report} **${escapeFormatting(
                    req.user.db.fullUsername
                )}** \`(${req.user.id})\` reported server **${escapeFormatting(
                    server.name
                )}** \`(${server._id})\``,
                embeds: [embed]
            });

            return res.status(200).json({
                error: false,
                status: 200,
                message: res.__("common.report.done")
            });
        } catch (e) {
            return res.status(500).json({
                error: true,
                status: 500,
                message: res.__("common.error.report")
            });
        }
    }
}

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

import { PathRoute } from "../../route.ts";
import type { Request, Response } from "express";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as functions from "../../../Util/Function/main.ts";
import * as serverCache from "../../../Util/Services/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import { renderStatus } from "../../../Util/Function/main.ts";

export class DeleteServer extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/delete", [variables, permission.auth]);
    }

    async handle(req: Request, res: Response) {
        const server: delServer | undefined = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return renderStatus(
                req,
                res,
                404,
                res.__("common.error.server.404")
            );

        if (server.owner.id !== req.user.id)
            return renderStatus(
                req,
                res,
                403,
                res.__("common.error.server.perms.delete")
            );

        await discord.channels.logs.send(
            `${settings.emoji.delete} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` deleted server **${functions.escapeFormatting(
                server.name
            )}** \`(${server._id})\``
        );

        await global.db.collection("servers").deleteOne({ _id: req.params.id });

        await global.db.collection("audit").insertOne({
            type: "DELETE_SERVER",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await serverCache.deleteServer(req.params.id);

        await discord.postWebMetric("server");

        res.redirect("/users/@me");
    }
}

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
import type { APIInvite, DiscordAPIError } from "discord.js";
import { RESTJSONErrorCodes } from "discord.js";
import * as discord from "../../../Util/Services/discord/index.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as serverCache from "../../../Util/Services/cache/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import {
    discordErrorPage,
    jsonError,
    renderStatus
} from "../../../Util/Function/web/responses.ts";
import { serverExists } from "../../../Util/Middleware/checks.ts";
import {
    syncedServerAuditBefore,
    syncedServerFields
} from "../../../Util/Function/servers/serverRecords.ts";
import { recordAudit } from "../../../Util/Function/staff/recordAudit.ts";

export class SyncServer extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/sync", [variables, permission.auth, serverExists]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const server: delServer | undefined = req.attached.server!;

        discord
            .fetchInvite(server.inviteCode)
            .then(async (invite: APIInvite) => {
                // A group-DM invite has no guild, so there's no server to sync.
                if (!invite.guild)
                    return renderStatus(
                        req,
                        res,
                        400,
                        res.__("common.error.listing.arr.invite.invalid")
                    );

                if (invite.guild.id !== server._id)
                    return res.status(400).render("status", {
                        res,
                        title: res.__("common.error"),
                        status: 404,
                        subtitle: res.__(
                            "common.error.server.arr.invite.sameServer"
                        ),
                        req,
                        type: "Error"
                    });

                if (invite.expires_at)
                    return jsonError(res, 400, [
                        res.__("common.error.server.invite.expires")
                    ]);

                await global.db.collection("servers").updateOne(
                    { _id: req.params.id },
                    {
                        $set: syncedServerFields(invite, invite.guild)
                    }
                );

                await recordAudit({
                    type: "SYNC_SERVER",
                    executor: req.user.id,
                    target: req.params.id,
                    reason: "None specified.",
                    details: {
                        new: syncedServerFields(invite, invite.guild),
                        old: syncedServerAuditBefore(server)
                    }
                });

                await serverCache.updateServer(req.params.id);

                res.redirect(`/servers/${req.params.id}`);
            })
            .catch((error: DiscordAPIError) =>
                discordErrorPage(
                    req,
                    res,
                    error,
                    RESTJSONErrorCodes.UnknownInvite,
                    res.__("common.error.listing.arr.invite.invalid")
                )
            );
    }
}

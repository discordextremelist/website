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
import type {
    APIInvite,
    DiscordAPIError,
    RESTGetAPIInviteQuery
} from "discord.js";
import { RESTJSONErrorCodes, Routes, makeURLSearchParams } from "discord.js";

import * as discord from "../../../Util/Services/discord/index.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import { listingCodeError } from "../../../Util/Function/listings/listingCode.ts";
import * as serverCache from "../../../Util/Services/cache/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import {
    serverExists,
    serverExistsJson
} from "../../../Util/Middleware/checks.ts";
import { sanitizeMinimalHtmlEscaped } from "../../../Util/Function/web/sanitize.ts";
import { logListingEvent } from "../../../Util/Function/listings/websiteLog.ts";
import {
    reviewRequired,
    serverListingErrors,
    tagHandler
} from "../../../Util/Function/servers/serverListing.ts";
import {
    discordErrorJson,
    jsonError
} from "../../../Util/Function/web/responses.ts";
import {
    editedServerAuditBefore,
    editedServerFields
} from "../../../Util/Function/servers/serverRecords.ts";

export class GetEditServer extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/edit", [
            variables,
            permission.auth,
            serverExists,
            permission.ownerOrAssistant(
                "server",
                "common.error.server.perms.edit"
            )
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const server: delServer | undefined = req.attached.server!;

        res.locals.premidPageInfo = res.__("premid.servers.edit", server.name);

        const clean = sanitizeMinimalHtmlEscaped(server.longDesc);

        res.render("templates/servers/edit", {
            title: res.__("page.servers.edit.title"),
            subtitle: res.__("page.servers.edit.subtitle", server.name),
            req,
            server,
            longDesc: clean
        });
    }
}

export class PostEditServer extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/edit", [
            variables,
            permission.auth,
            serverExistsJson,
            permission.ownerOrAssistant(
                "server",
                "common.error.server.perms.edit",
                { json: true }
            )
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        let error = false;
        let errors: string[] = [];

        const server: delServer = req.attached.server!;

        res.locals.premidPageInfo = res.__("premid.servers.edit", server.name);

        const codeError = listingCodeError(req.body.invite, res, "invite", 32);
        if (codeError) {
            error = true;
            errors.push(codeError);
        }

        for (const message of await serverListingErrors(req.body, res)) {
            error = true;
            errors.push(message);
        }

        let tags: string[] = tagHandler(req, server);

        if (error === true) return jsonError(res, 400, errors);

        discord
            .restGet<APIInvite>(Routes.invite(req.body.invite), {
                query: makeURLSearchParams({
                    // Makes approximate_presence_count and
                    // approximate_member_count always present on the invite.
                    with_counts: true,
                    with_expiration: true
                } satisfies RESTGetAPIInviteQuery)
            })
            .then(async (invite: APIInvite) => {
                // A group-DM invite has no guild, so there's no server to list.
                if (!invite.guild)
                    return jsonError(res, 400, [
                        res.__("common.error.listing.arr.invite.invalid")
                    ]);

                if (invite.guild.id !== server._id)
                    return jsonError(res, 400, [
                        res.__("common.error.server.arr.invite.sameServer")
                    ]);

                if (invite.expires_at)
                    return jsonError(res, 400, [
                        res.__("common.error.server.invite.expires")
                    ]);

                await global.db.collection("servers").updateOne(
                    { _id: req.params.id },
                    {
                        $set: editedServerFields(
                            req,
                            invite,
                            invite.guild,
                            tags,
                            reviewRequired
                        )
                    }
                );

                await logListingEvent(req, "server", "edited", {
                    _id: invite.guild.id,
                    name: invite.guild.name
                });

                await global.db.collection("audit").insertOne({
                    type: "EDIT_SERVER",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: editedServerFields(
                            req,
                            invite,
                            invite.guild,
                            tags,
                            reviewRequired
                        ),
                        old: editedServerAuditBefore(server)
                    }
                });

                await serverCache.updateServer(req.params.id);

                return res.status(200).json({
                    error: false,
                    status: 200,
                    errors: [],
                    id: invite.guild.id
                });
            })
            .catch((error: DiscordAPIError) =>
                discordErrorJson(
                    res,
                    error,
                    RESTJSONErrorCodes.UnknownInvite,
                    res.__("common.error.listing.arr.invite.invalid")
                )
            );
    }
}

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
import { listingCodeError } from "../../../Util/Function/listingCode.ts";
import * as serverCache from "../../../Util/Services/cache/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import { tagHandler, reviewRequired } from "../index.ts";
import { logListingEvent } from "../../../Util/Function/websiteLog.ts";
import { serverListingErrors } from "../../../Util/Function/serverListing.ts";
import {
    discordErrorJson,
    jsonError
} from "../../../Util/Function/responses.ts";
import {
    submittedServer,
    submittedServerAudit
} from "../../../Util/Function/serverRecords.ts";

export class GetSubmitServer extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/submit", [variables, permission.auth]);
    }

    handle(req: AuthedRequest, res: Response) {
        res.locals.premidPageInfo = res.__("premid.servers.submit");

        res.render("templates/servers/submit", {
            title: res.__("common.nav.me.submitServer"),
            subtitle: res.__("common.nav.me.submitServer.subtitle"),
            req
        });
    }
}

export class PostSubmitServer extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/submit", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: Response) {
        res.locals.premidPageInfo = res.__("premid.servers.submit");

        let error = false;
        let errors: string[] = [];

        const codeError = listingCodeError(
            req.body.invite,
            res,
            "invite",
            2000
        );
        if (codeError) {
            error = true;
            errors.push(codeError);
        }

        for (const message of await serverListingErrors(req.body, res)) {
            error = true;
            errors.push(message);
        }

        let tags: string[] = tagHandler(req, false);

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

                const serverExists: delServer | null = await global.db
                    .collection<delServer>("servers")
                    .findOne({ _id: invite.guild.id });
                if (serverExists)
                    return jsonError(res, 409, [
                        res.__("common.error.server.conflict")
                    ]);

                if (invite.expires_at)
                    return jsonError(res, 400, [
                        res.__("common.error.server.invite.expires")
                    ]);

                await global.db
                    .collection<delServer>("servers")
                    .insertOne(
                        submittedServer(
                            req,
                            invite,
                            invite.guild,
                            tags,
                            reviewRequired
                        )
                    );

                await logListingEvent(req, "server", "added", {
                    _id: invite.guild.id,
                    name: invite.guild.name
                });

                await global.db.collection("audit").insertOne({
                    type: "SUBMIT_SERVER",
                    executor: req.user.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: submittedServerAudit(
                            req,
                            invite,
                            invite.guild,
                            tags,
                            reviewRequired
                        )
                    }
                });

                await serverCache.updateServer(invite.guild.id);

                await discord.postWebMetric("server");

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

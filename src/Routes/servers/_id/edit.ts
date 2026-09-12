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

import settings from "../../../../settings.json" with { type: "json" };

import * as discord from "../../../Util/Services/discord.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as functions from "../../../Util/Function/main.ts";
import * as serverCache from "../../../Util/Services/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import { tagHandler, reviewRequired } from "../index.ts";
import { renderStatus } from "../../../Util/Function/main.ts";
import { serverExists } from "../../../Util/Middleware/checks.ts";
import { sanitizeMinimalHtmlEscaped } from "../../../Util/Function/sanitize.ts";
import { ownsOrAssistant } from "../../../Util/Function/main.ts";
import { websiteLogMessage } from "../../../Util/Function/main.ts";
import { serverListingErrors } from "../../../Util/Function/serverListing.ts";

export class GetEditServer extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/edit", [variables, permission.auth, serverExists]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const server: delServer | undefined = req.attached.server!;

        if (!ownsOrAssistant(req, server))
            return renderStatus(
                req,
                res,
                403,
                res.__("common.error.server.perms.edit")
            );

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
        super("post", "/:id/edit", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: Response) {
        let error = false;
        let errors: string[] = [];

        const server: delServer | null = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return res.status(404).json({
                error: true,
                status: 404,
                errors: [res.__("common.error.server.404")]
            });

        if (!ownsOrAssistant(req, server))
            return res.status(403).json({
                error: true,
                status: 403,
                errors: [res.__("common.error.server.perms.edit")]
            });

        res.locals.premidPageInfo = res.__("premid.servers.edit", server.name);

        if (!req.body.invite) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invite.invalid"));
        } else {
            if (
                typeof req.body.invite !== "string" ||
                req.body.invite.includes(" ")
            ) {
                error = true;
                errors.push(res.__("common.error.listing.arr.invite.invalid"));
            } else if (req.body.invite.length > 32) {
                error = true;
                errors.push(res.__("common.error.listing.arr.invite.tooLong"));
            } else if (functions.isURL(req.body.invite)) {
                error = true;
                errors.push(res.__("common.error.listing.arr.invite.isURL"));
            } else if (req.body.invite.includes("discord.gg")) {
                error = true;
                errors.push(res.__("common.error.server.arr.invite.dgg"));
            }
        }

        for (const message of await serverListingErrors(req.body, res)) {
            error = true;
            errors.push(message);
        }

        let tags: string[] = tagHandler(req, server);

        if (error === true)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });

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
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [
                            res.__("common.error.listing.arr.invite.invalid")
                        ]
                    });

                if (invite.guild.id !== server._id)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [
                            res.__("common.error.server.arr.invite.sameServer")
                        ]
                    });

                if (invite.expires_at)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.server.invite.expires")]
                    });

                await global.db.collection("servers").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            name: invite.guild.name,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            inviteCode: req.body.invite,
                            previewChannel: req.body.previewChannel,
                            tags: tags,
                            counts: {
                                online: invite.approximate_presence_count!,
                                members: invite.approximate_member_count!
                            },
                            icon: {
                                hash: invite.guild.icon,
                                url: `https://cdn.discordapp.com/icons/${invite.guild.id}/${invite.guild.icon}`
                            },
                            links: {
                                invite: `https://discord.gg/${req.body.invite}`,
                                website: req.body.website,
                                donation: req.body.donationUrl
                            },
                            status: {
                                reviewRequired: reviewRequired
                            }
                        } satisfies Partial<delServer>
                    }
                );

                await discord.channels.logs.send(
                    websiteLogMessage(
                        req,
                        settings.emoji.edit,
                        "edited server",
                        invite.guild.name,
                        invite.guild.id,
                        `\n<${settings.website.url}/servers/${invite.guild.id}>`
                    )
                );

                await global.db.collection("audit").insertOne({
                    type: "EDIT_SERVER",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: {
                            name: invite.guild.name,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            inviteCode: req.body.invite,
                            previewChannel: req.body.previewChannel,
                            tags: tags,
                            counts: {
                                online: invite.approximate_presence_count!,
                                members: invite.approximate_member_count!
                            },
                            icon: {
                                hash: invite.guild.icon,
                                url: `https://cdn.discordapp.com/icons/${invite.guild.id}/${invite.guild.icon}`
                            },
                            links: {
                                invite: `https://discord.gg/${req.body.invite}`,
                                website: req.body.website,
                                donation: req.body.donationUrl
                            },
                            status: {
                                reviewRequired: reviewRequired
                            }
                        } satisfies Partial<delServer>,
                        old: {
                            name: server.name,
                            shortDesc: server.shortDesc,
                            longDesc: server.longDesc,
                            inviteCode: server.inviteCode,
                            previewChannel: server.previewChannel,
                            tags: server.tags,
                            counts: {
                                online: server.counts.online,
                                members: server.counts.members
                            },
                            icon: {
                                hash: server.icon.hash,
                                url: server.icon.url
                            },
                            links: {
                                invite: server.links.invite,
                                website: server.links.website,
                                donation: server.links.donation
                            },
                            status: {
                                reviewRequired: server.status.reviewRequired
                            }
                        } satisfies Partial<delServer>
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
            .catch((error: DiscordAPIError) => {
                if (error.code === RESTJSONErrorCodes.UnknownInvite)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [
                            res.__("common.error.listing.arr.invite.invalid")
                        ]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [
                        `${error.name}: ${error.message}`,
                        `${error.code} ${error.method} ${error.url}`
                    ]
                });
            });
    }
}

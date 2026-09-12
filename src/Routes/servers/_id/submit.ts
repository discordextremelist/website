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
import { websiteLogMessage } from "../../../Util/Function/main.ts";
import { serverListingErrors } from "../../../Util/Function/serverListing.ts";

export class GetSubmitServer extends PathRoute<"get"> {
    constructor() {
        super("get", "/submit", [variables, permission.auth]);
    }

    handle(req: Request, res: Response) {
        res.locals.premidPageInfo = res.__("premid.servers.submit");

        res.render("templates/servers/submit", {
            title: res.__("common.nav.me.submitServer"),
            subtitle: res.__("common.nav.me.submitServer.subtitle"),
            req
        });
    }
}

export class PostSubmitServer extends PathRoute<"post"> {
    constructor() {
        super("post", "/submit", [variables, permission.auth]);
    }

    async handle(req: Request, res: Response) {
        res.locals.premidPageInfo = res.__("premid.servers.submit");

        let error = false;
        let errors: string[] = [];

        if (
            !req.body.invite ||
            typeof req.body.invite !== "string" ||
            req.body.invite.includes(" ")
        ) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invite.invalid"));
        }

        if (req.body.invite.length > 2000) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invite.tooLong"));
        }

        if (functions.isURL(req.body.invite)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invite.isURL"));
        }

        if (req.body.invite.includes("discord.gg")) {
            error = true;
            errors.push(res.__("common.error.server.arr.invite.dgg"));
        }

        for (const message of await serverListingErrors(req.body, res)) {
            error = true;
            errors.push(message);
        }

        let tags: string[] = tagHandler(req, false);

        if (error === true)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });

        discord
            .restGet<APIInvite>(Routes.invite(req.body.invite), {
                query: makeURLSearchParams({
                    with_counts: true,
                    with_expiration: true
                } satisfies RESTGetAPIInviteQuery)
            })
            .then(async (invite: APIInvite) => {
                const serverExists: delServer | undefined = await global.db
                    .collection<delServer>("servers")
                    .findOne({ _id: invite.guild.id });
                if (serverExists)
                    return res.status(409).json({
                        error: true,
                        status: 409,
                        errors: [res.__("common.error.server.conflict")]
                    });

                if (invite.expires_at)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.server.invite.expires")]
                    });

                await global.db.collection<delServer>("servers").insertOne({
                    _id: invite.guild.id,
                    inviteCode: req.body.invite,
                    name: invite.guild.name,
                    shortDesc: req.body.shortDescription,
                    longDesc: req.body.longDescription,
                    previewChannel: req.body.previewChannel,
                    tags: tags,
                    counts: {
                        online: invite.approximate_presence_count,
                        members: invite.approximate_member_count
                    },
                    owner: {
                        id: req.user.id
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
                } satisfies delServer);

                await discord.channels.logs.send(
                    websiteLogMessage(
                        req,
                        settings.emoji.add,
                        "added server",
                        invite.guild.name,
                        invite.guild.id,
                        `\n<${settings.website.url}/servers/${invite.guild.id}>`
                    )
                );

                await global.db.collection("audit").insertOne({
                    type: "SUBMIT_SERVER",
                    executor: req.user.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: {
                            _id: invite.guild.id,
                            inviteCode: req.body.invite,
                            name: invite.guild.name,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            previewChannel: req.body.previewChannel,
                            tags: tags,
                            owner: {
                                id: req.user.id
                            },
                            counts: {
                                online: invite.approximate_presence_count,
                                members: invite.approximate_member_count
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
                        } satisfies delServer
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

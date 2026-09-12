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
import { Response as fetchRes } from "node-fetch";
import type {
    APIInvite,
    DiscordAPIError,
    RESTGetAPIInviteQuery
} from "discord.js";
import { RESTJSONErrorCodes, Routes, makeURLSearchParams } from "discord.js";
import fetch from "node-fetch";
import sanitizeHtml from "sanitize-html";
import settings from "../../../../settings.json" with { type: "json" };
import htmlRef from "../../../../htmlReference.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as functions from "../../../Util/Function/main.ts";
import * as serverCache from "../../../Util/Services/serverCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import { tagHandler, reviewRequired } from "../index.ts";
import { renderStatus } from "../../../Util/Function/main.ts";

export class GetEditServer extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/edit", [variables, permission.auth]);
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

        if (
            server.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return renderStatus(
                req,
                res,
                403,
                res.__("common.error.server.perms.edit")
            );

        res.locals.premidPageInfo = res.__("premid.servers.edit", server.name);

        const clean = sanitizeHtml(server.longDesc, {
            allowedTags: htmlRef.minimal.tags,
            allowedAttributes: htmlRef.minimal.attributes,
            allowVulnerableTags: true,
            disallowedTagsMode: "recursiveEscape"
        });

        res.render("templates/servers/edit", {
            title: res.__("page.servers.edit.title"),
            subtitle: res.__("page.servers.edit.subtitle", server.name),
            req,
            server,
            longDesc: clean
        });
    }
}

export class PostEditServer extends PathRoute<"post"> {
    constructor() {
        super("post", "/:id/edit", [variables, permission.auth]);
    }

    async handle(req: Request, res: Response) {
        let error = false;
        let errors: string[] = [];

        const server: delServer | undefined = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return res.status(404).json({
                error: true,
                status: 404,
                errors: [res.__("common.error.server.404")]
            });

        if (
            server.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
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

        if (req.body.website && !functions.isURL(req.body.website)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.website"));
        }

        if (req.body.donationUrl && !functions.isURL(req.body.donationUrl)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.donation"));
        }

        if (req.body.previewChannel) {
            let fetchChannel = true;

            if (
                Number.isNaN(req.body.previewChannel) ||
                req.body.previewChannel.includes(" ")
            ) {
                error = true;
                errors.push(
                    res.__("common.error.server.arr.previewChannel.invalid")
                );
                fetchChannel = false;
            }
            if (
                req.body.previewChannel &&
                req.body.previewChannel.length > 32
            ) {
                error = true;
                errors.push(
                    res.__("common.error.server.arr.previewChannel.tooLong")
                );
                fetchChannel = false;
            }

            if (fetchChannel)
                await discord.bot.rest
                    .get(Routes.channel(req.body.previewChannel))
                    .catch((e: DiscordAPIError) => {
                        if ([400, 404].includes(Number(e.code))) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.server.arr.previewChannel.nonexistent"
                                )
                            );
                            fetchChannel = false;
                        }
                    });

            if (fetchChannel)
                await fetch("https://stonks.widgetbot.io/api/graphql", {
                    method: "post",
                    body: JSON.stringify({
                        query: `{channel(id:"${req.body.previewChannel}"){id}}`
                    }),
                    headers: { "Content-Type": "application/json" }
                })
                    .then(async (fetchRes: fetchRes) => {
                        const data: any = await fetchRes.json();
                        if (!data.channel?.id) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.channelNotFound"
                                )
                            );
                        }
                    })
                    .catch(() => {
                        error = true;
                        errors.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.channelNotFound"
                            )
                        );
                    });
        }

        if (!req.body.shortDescription) {
            error = true;
            errors.push(res.__("common.error.listing.arr.shortDescRequired"));
        } else if (req.body.shortDescription.length > 200) {
            error = true;
            errors.push(res.__("common.error.listing.arr.shortDescTooLong"));
        }

        if (!req.body.longDescription) {
            error = true;
            errors.push(res.__("common.error.listing.arr.longDescRequired"));
        }

        let tags: string[] = tagHandler(req, server);

        if (error === true)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });

        discord.bot.rest
            .get(Routes.invite(req.body.invite), {
                query: makeURLSearchParams({
                    with_counts: true,
                    with_expiration: true
                } satisfies RESTGetAPIInviteQuery)
            })
            .then(async (invite: APIInvite) => {
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
                        } satisfies Partial<delServer>
                    }
                );

                await discord.channels.logs.send(
                    `${settings.emoji.edit} **${functions.escapeFormatting(
                        req.user.db.fullUsername
                    )}** \`(${
                        req.user.id
                    })\` edited server **${functions.escapeFormatting(
                        invite.guild.name
                    )}** \`(${invite.guild.id})\`\n<${
                        settings.website.url
                    }/servers/${invite.guild.id}>`
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

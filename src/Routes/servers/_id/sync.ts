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
import * as discord from "../../../Util/Services/discord.ts";
import * as permission from "../../../Util/Function/permissions.ts";
import * as serverCache from "../../../Util/Services/serverCaching.ts";
import { variables } from "../../../Util/Function/variables.ts";

export class SyncServer extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/sync", [variables, permission.auth]);
    }

    async handle(req: Request, res: Response) {
        const server: delServer | undefined = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.server.404"),
                type: "Error",
                req: req
            });

        discord.bot.rest
            .get(Routes.invite(server.inviteCode), {
                query: makeURLSearchParams({
                    with_counts: true,
                    with_expiration: true
                } satisfies RESTGetAPIInviteQuery)
            })
            .then(async (invite: APIInvite) => {
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
                            counts: {
                                online: invite.approximate_presence_count,
                                members: invite.approximate_member_count
                            },
                            icon: {
                                hash: invite.guild.icon,
                                url: `https://cdn.discordapp.com/icons/${invite.guild.id}/${invite.guild.icon}`
                            }
                        } satisfies Partial<delServer>
                    }
                );

                await global.db.collection("audit").insertOne({
                    type: "SYNC_SERVER",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: {
                            name: invite.guild.name,
                            counts: {
                                online: invite.approximate_presence_count,
                                members: invite.approximate_member_count
                            },
                            icon: {
                                hash: invite.guild.icon,
                                url: `https://cdn.discordapp.com/icons/${invite.guild.id}/${invite.guild.icon}`
                            }
                        } satisfies Partial<delServer>,
                        old: {
                            name: server.name,
                            counts: {
                                online: server.counts.online,
                                members: server.counts.members
                            },
                            icon: {
                                hash: server.icon.hash,
                                url: server.icon.url
                            }
                        } satisfies Partial<delServer>
                    }
                });

                await serverCache.updateServer(req.params.id);

                res.redirect(`/servers/${req.params.id}`);
            })
            .catch((error: DiscordAPIError) => {
                if (error.code === RESTJSONErrorCodes.UnknownInvite)
                    return res.status(400).render("status", {
                        res,
                        title: res.__("common.error"),
                        status: 400,
                        subtitle: res.__(
                            "common.error.listing.arr.invite.invalid"
                        ),
                        req,
                        type: "Error"
                    });

                return res.status(400).render("status", {
                    res,
                    title: res.__("common.error"),
                    status: 400,
                    subtitle: `${error.name}: ${error.message} | ${error.code} ${error.method} ${error.url}`,
                    req,
                    type: "Error"
                });
            });
    }
}

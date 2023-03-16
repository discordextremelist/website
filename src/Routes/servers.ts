/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020 Carolina Mitchell-Acason, John Burke, Advaith Jagathesan

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

import express from "express";
import type { Request, Response } from "express";
import { Response as fetchRes } from "node-fetch";
import type { APIInvite, RequestData, RESTGetAPIInviteQuery, RESTGetAPIInviteResult } from "discord.js";
import { RESTJSONErrorCodes, Routes } from "discord.js"
import fetch from "node-fetch";
import type { DiscordAPIError } from "discord.js";
import sanitizeHtml from "sanitize-html";

import settings from "../../settings.json" assert { type: "json" };
import htmlRef from "../../htmlReference.json" assert { type: "json" };
import * as discord from "../Util/Services/discord.js";
import * as permission from "../Util/Function/permissions.js";
import * as functions from "../Util/Function/main.js";
import * as userCache from "../Util/Services/userCaching.js";
import * as serverCache from "../Util/Services/serverCaching.js";
import { variables } from "../Util/Function/variables.js";
import * as tokenManager from "../Util/Services/adminTokenManager.js";
import { EmbedBuilder } from "discord.js";
import type { serverReasons } from "../../@types/enums.js";
import { rest } from "../Util/Function/rest.js";
import mdi from "markdown-it";
import entities from "html-entities";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
const DAPI = "https://discord.com/api/v10";
const md = new mdi
const router = express.Router();
let reviewRequired = false; // Needs to be outside of the functions or it cannot be referenced outside of x function - AJ

function serverType(bodyType: string): number {
    let type: serverReasons = parseInt(bodyType);

    switch (type) {
        case 0:
        case 1:
        case 3:
        case 4:
        case 5:
            break;
        default:
            type = 0;
    }

    return type;
}

function tagHandler(req: express.Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>, server: false | delServer) {
    let tags: string[] = [];

    if (req.body.gaming === true) tags.push("Gaming");
    if (req.body.music === true) tags.push("Music");
    if (req.body.mediaEntertain === true) tags.push("Media & Entertainment");
    if (req.body.createArts === true) tags.push("Creative Arts");
    if (req.body.sciTech === true) tags.push("Science & Tech");
    if (req.body.edu === true) tags.push("Education");
    if (req.body.fashBeaut === true) tags.push("Fashion & Beauty");
    if (req.body.relIdentity === true)
        tags.push("Relationships & Identity");
    if (req.body.travelCuis === true) tags.push("Travel & Food");
    if (req.body.fitHealth === true) tags.push("Fitness & Health");
    if (req.body.finance === true) tags.push("Finance");
    if (req.body.contCreat === true) tags.push("Content Creation");
    if (req.body.nsfw === true) tags.push("NSFW");

    if (req.body.lgbt === true) {
        tags.push("LGBT");
        if (server) {
            if (!server.tags.includes("LGBT")) reviewRequired = true;
            if (server.tags.includes("LGBT") && server.status.reviewRequired === true) reviewRequired = true;
        } else reviewRequired = true;
    }

    return tags;
}

router.get(
    "/submit",
    variables,
    permission.auth,
    (req: Request, res: Response) => {
        res.locals.premidPageInfo = res.__("premid.servers.submit");

        res.render("templates/servers/submit", {
            title: res.__("common.nav.me.submitServer"),
            subtitle: res.__("common.nav.me.submitServer.subtitle"),
            req
        });
    }
);

router.post(
    "/submit",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        res.locals.premidPageInfo = res.__("premid.servers.submit");

        let error = false;
        let errors: string[] = [];

        if (!req.body.invite || typeof req.body.invite !== "string" || req.body.invite.includes(" ")) {
            error = true
            errors.push(res.__("common.error.listing.arr.invite.invalid"))
        }

        if (req.body.invite.length > 2000) {
            error = true
            errors.push(res.__("common.error.listing.arr.invite.tooLong"))
        }

        if (functions.isURL(req.body.invite)) {
            error = true
            errors.push(res.__("common.error.listing.arr.invite.isURL"))
        }

        if (req.body.invite.includes("discord.gg")) {
            error = true
            errors.push(res.__("common.error.server.arr.invite.dgg"))
        }

        if (req.body.website && !functions.isURL(req.body.website)) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.invalidURL.website")
            );
        }

        if (
            req.body.donationUrl &&
            !functions.isURL(req.body.donationUrl)
        ) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.invalidURL.donation")
            );
        }

        if (req.body.previewChannel) {
            let fetchChannel = true;

            if (
                isNaN(req.body.previewChannel) ||
                req.body.previewChannel.includes(" ")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.server.arr.previewChannel.invalid"
                    )
                );
                fetchChannel = false;
            }
            if (
                req.body.previewChannel &&
                req.body.previewChannel.length > 32
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.server.arr.previewChannel.tooLong"
                    )
                );
                fetchChannel = false;
            }

            if (fetchChannel)
                await rest.get(Routes.channel(req.body.previewChannel))
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
                    })

            if (fetchChannel)
                await fetch(`https://stonks.widgetbot.io/api/graphql`, {
                    method: 'post',
                    body: JSON.stringify({
                        query: `{channel(id:"${req.body.previewChannel}"){id}}`
                    }),
                    headers: { 'Content-Type': 'application/json' },
                }).then(async (fetchRes: fetchRes) => {
                    const data: any = await fetchRes.json();
                    if (!data.channel?.id) {
                        error = true;
                        errors.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.channelNotFound"
                            )
                        );
                    }
                });
        }

        if (!req.body.shortDescription) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.shortDescRequired")
            );
        } else if (req.body.shortDescription.length > 200) {
            error = true;
            errors.push(res.__("common.error.listing.arr.shortDescTooLong"))
        }

        if (!req.body.longDescription) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.longDescRequired")
            );
        }

        let tags: string[] = tagHandler(req, false);

        if (error === true)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });

        (await fetch(DAPI + `/invites/${req.body.invite}?with_counts=true&with_expiration=true`)).json()
            .then(async (invite: APIInvite) => {
                console.log(invite)
                const serverExists:
                    | delServer
                    | undefined = await global.db
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
                } as delServer);

                discord.channels.logs.send(
                    `${settings.emoji.add} **${functions.escapeFormatting(
                        req.user.db.fullUsername
                    )}** \`(${req.user.id
                    })\` added server **${functions.escapeFormatting(
                        invite.guild.name
                    )}** \`(${invite.guild.id})\`\n<${settings.website.url
                    }/servers/${invite.guild.id}>`
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
                        } as delServer
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
                        errors: [res.__("common.error.listing.arr.invite.invalid")]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [`${error.name}: ${error.message}`, `${error.code} ${error.method} ${error.url}`]
                });
            });
    }
);

router.get("/:id", variables, async (req: Request, res: Response) => {
    res.locals.pageType = {
        server: true,
        bot: false
    };

    let server: delServer | undefined = await serverCache.getServer(
        req.params.id
    );
    if (!server) {
        server = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });
        if (!server)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.server.404"),
                type: "Error",
                req: req,
                pageType: { server: false, bot: false }
            });
    }

    if (server.tags.includes("LGBT"))
        res.redirect(`${settings.website.lgbtSiteURL}/servers/${server._id}`);

    let serverOwner: delUser | undefined = await userCache.getUser(
        server.owner.id
    );
    if (!serverOwner) {
        serverOwner = await global.db
            .collection<delUser>("users")
            .findOne({ _id: server.owner.id });
    }

    res.locals.premidPageInfo = res.__("premid.servers.view", server.name);

    const dirty = entities.decode(md.render(server.longDesc));
    let clean: string;
    clean = sanitizeHtml(dirty, {
        allowedTags: htmlRef.minimal.tags,
        allowedAttributes: htmlRef.minimal.attributes,
        allowVulnerableTags: true
    });

    res.render("templates/servers/view", {
        title: `${server.name} | ${res.__("common.servers.discord")}`,
        subtitle: server.shortDesc,
        server,
        longDesc: clean,
        serverOwner,
        webUrl: settings.website.url,
        req
    });
});

router.get(
    "/:id/exists",
    permission.auth,
    async (req, res) => {
        res.send(String(await global.redis?.hexists("servers", req.params.id)))
    })

router.get(
    "/:id/src",
    variables,
    permission.auth,
    permission.admin,
    async (req: Request, res: Response) => {
        if (req.params.id === "@me") {
            if (!req.user) return res.redirect("/auth/login");
            req.params.id = req.user.id;
        }

        if (!req.query.token) return res.json({});

        const tokenCheck = await tokenManager.verifyToken(
            req.user.id,
            req.query.token as string
        );
        if (tokenCheck === false) return res.json({});

        const cache = await serverCache.getServer(req.params.id);
        const db = await global.db
            .collection("servers")
            .findOne({ _id: req.params.id });

        return res.json({ cache: cache, db: db });
    }
);

router.get(
    "/:id/edit",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        const server: delServer | undefined = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.server.404"),
                type: "Error",
                req: req
            });

        if (
            server.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.server.perms.edit"),
                status: 403,
                type: "Error",
                req
            });

        res.locals.premidPageInfo = res.__("premid.servers.edit", server.name);

        const clean = sanitizeHtml(server.longDesc, {
            allowedTags: htmlRef.minimal.tags,
            allowedAttributes: htmlRef.minimal.attributes,
            allowVulnerableTags: true,
            disallowedTagsMode: "escape"
        });

        res.render("templates/servers/edit", {
            title: res.__("page.servers.edit.title"),
            subtitle: res.__("page.servers.edit.subtitle", server.name),
            req,
            server,
            longDesc: clean
        });
    }
);

router.post(
    "/:id/edit",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
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
                isNaN(req.body.previewChannel) ||
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
                await rest.get(Routes.channel(req.body.previewChannel))
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
                    })

            if (fetchChannel)
                await fetch(`https://stonks.widgetbot.io/api/graphql`, {
                    method: 'post',
                    body: JSON.stringify({
                        query: `{channel(id:"${req.body.previewChannel}"){id}}`
                    }),
                    headers: { 'Content-Type': 'application/json' },
                }).then(async (fetchRes: fetchRes) => {
                    const data: any = await fetchRes.json();
                    if (!data.channel?.id) {
                        error = true;
                        errors.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.channelNotFound"
                            )
                        );
                    }
                });
        }

        if (!req.body.shortDescription) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.shortDescRequired")
            );
        } else if (req.body.shortDescription.length > 200) {
            error = true;
            errors.push(res.__("common.error.listing.arr.shortDescTooLong"))
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

        (await fetch(DAPI + `/invites/${req.body.invite}?with_counts=true&with_expiration=true`)).json()
            .then(async (invite: APIInvite) => {
                if (invite.guild.id !== server._id)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.server.arr.invite.sameServer")]
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
                        } as delServer
                    }
                );

                discord.channels.logs.send(
                    `${settings.emoji.edit} **${functions.escapeFormatting(
                        req.user.db.fullUsername
                    )}** \`(${req.user.id
                    })\` edited server **${functions.escapeFormatting(
                        invite.guild.name
                    )}** \`(${invite.guild.id})\`\n<${settings.website.url
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
                        } as delServer,
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
                        } as delServer
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
                        errors: [res.__("common.error.listing.arr.invite.invalid")]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [`${error.name}: ${error.message}`, `${error.code} ${error.method} ${error.url}`]
                });
            });
    }
);

router.get(
    "/:id/decline",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const server: delServer | undefined = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.server.404"),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__(
            "premid.servers.decline",
            server.name
        );

        if (!server.status || !server.status.reviewRequired)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.server.notInQueue"),
                req,
                type: "Error"
            });

        let redirect = `/servers/${server._id}`;

        if (req.query.from && req.query.from === "queue")
            redirect = "/staff/server_queue";

        res.locals.premidPageInfo = res.__(
            "premid.servers.decline",
            server.name
        );

        res.render("templates/servers/staffActions/remove", {
            title: res.__("page.servers.decline.title"),
            icon: "minus",
            subtitle: res.__("page.servers.decline.subtitle", server.name),
            removingServer: server,
            req,
            redirect
        });
    }
);

router.post(
    "/:id/decline",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const server: delServer | undefined = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.server.404"),
                req,
                type: "Error"
            });

        if (!server.status || !server.status.reviewRequired)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.server.notInQueue"),
                req,
                type: "Error"
            });

        if (!req.body.reason && !req.user.db.rank.admin) {
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.reasonRequired"),
                req,
                type: "Error"
            });
        }

        const tags = new Set(server.tags);
        tags.delete("LGBT");

        await global.db.collection("servers").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    tags: [...tags],
                    "status.reviewRequired": false
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    "staffTracking.handledServers.allTime.total": req.user.db.staffTracking.handledServers.allTime.total += 1,
                    "staffTracking.handledServers.allTime.declined": req.user.db.staffTracking.handledServers.allTime.declined += 1,
                    "staffTracking.handledServers.thisWeek.total": req.user.db.staffTracking.handledServers.thisWeek.total += 1,
                    "staffTracking.handledServers.thisWeek.declined": req.user.db.staffTracking.handledServers.thisWeek.declined += 1
                }
            }
        );

        const type = serverType(req.body.type);

        await global.db.collection("audit").insertOne({
            type: "DECLINE_SERVER",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            reasonType: type
        });

        await serverCache.updateServer(req.params.id);

        const embed = new EmbedBuilder();
        embed.setColor(0x2f3136);
        embed.setTitle("Reason");
        embed.setDescription(req.body.reason);
        embed.setURL(`${settings.website.url}/servers/${server._id}`);
        embed.setFooter({ text: "It will still be shown as a normal server, it was declined from being listed as an LGBT community." });

        discord.channels.logs.send({
            content: `${settings.emoji.cross} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${req.user.id
                })\` declined server **${functions.escapeFormatting(
                    server.name
                )}** \`(${server._id
                })\``,
            embeds: [embed]
        });

        const owner = await discord.getMember(server.owner.id);
        if (owner)
            owner
                .send(
                    `${settings.emoji.cross
                    } **|** Your server **${functions.escapeFormatting(
                        server.name
                    )}** \`(${server._id
                    })\` was declined from being listed as an LGBT community. It will still appear as a normal server.\n**Reason:** \`${req.body.reason || "None specified."
                    }\``
                )
                .catch((e) => {
                    console.error(e);
                });

        res.redirect("/staff/server_queue");
    }
);

router.get(
    "/:id/approve",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const server: delServer | undefined = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.server.404"),
                req,
                type: "Error"
            });

        if (!server.status || !server.status.reviewRequired)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.server.notInQueue"),
                req,
                type: "Error"
            });

        await global.db.collection("servers").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.reviewRequired": false
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    "staffTracking.handledServers.allTime.total": req.user.db.staffTracking.handledServers.allTime.total += 1,
                    "staffTracking.handledServers.allTime.approved": req.user.db.staffTracking.handledServers.allTime.approved += 1,
                    "staffTracking.handledServers.thisWeek.total": req.user.db.staffTracking.handledServers.thisWeek.total += 1,
                    "staffTracking.handledServers.thisWeek.approved": req.user.db.staffTracking.handledServers.thisWeek.approved += 1
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "APPROVE_SERVER",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified."
        });

        await serverCache.updateServer(req.params.id);

        discord.channels.logs.send(
            `${settings.emoji.check} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${req.user.id
            })\` approved server **${functions.escapeFormatting(
                server.name
            )}** \`(${server._id})\` to be listed as an LGBT community.\n<${settings.website.url
            }/servers/${server._id}>`
        )
            .catch((e) => {
                console.error(e);
            });

        const owner = await discord.getMember(server.owner.id);
        if (owner)
            owner
                .send(
                    `${settings.emoji.check
                    } **|** Your server **${functions.escapeFormatting(
                        server.name
                    )}** \`(${server._id
                    })\` was approved as being listed as an LGBT community.`
                )
                .catch((e) => {
                    console.error(e);
                });

        res.redirect("/staff/server_queue");
    }
);

router.get(
    "/:id/delete",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        const server: delServer | undefined = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.server.404"),
                type: "Error",
                req: req
            });

        if (server.owner.id !== req.user.id)
            return res.status(403).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.server.perms.delete"),
                status: 403,
                type: "Error",
                req
            });

        discord.channels.logs.send(
            `${settings.emoji.delete} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${req.user.id
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
);

router.get(
    "/:id/remove",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const server: delServer | undefined = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.server.404"),
                req,
                type: "Error"
            });

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
);

router.post(
    "/:id/remove",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const server: delServer | undefined = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.server.404"),
                req,
                type: "Error"
            });

        if (!req.body.reason && !req.user.db.rank.admin) {
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.reasonRequired"),
                req,
                type: "Error"
            });
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

        discord.channels.logs.send({
            content: `${settings.emoji.delete} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${req.user.id
                })\` removed server **${functions.escapeFormatting(
                    server.name
                )}** \`(${server._id})\``,
            embeds: [embed]
        });

        const owner = await discord.getMember(server.owner.id);
        if (owner)
            owner
                .send(
                    `${settings.emoji.delete
                    } **|** Your server **${functions.escapeFormatting(
                        server.name
                    )}** \`(${server._id})\` has been removed!\n**Reason:** \`${req.body.reason || "None specified."
                    }\``
                )
                .catch((e: string) => {
                    console.error(e);
                });

        await discord.postWebMetric("server");

        res.redirect("/servers");
    }
);

router.get(
    "/:id/sync",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        const server: delServer | undefined = await global.db
            .collection<delServer>("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.server.404"),
                type: "Error",
                req: req
            });

        (await fetch(DAPI + `/invites/${req.body.invite}?with_counts=true&with_expiration=true`)).json()
            .then(async (invite: APIInvite) => {
                if (invite.guild.id !== server._id)
                    return res.status(400).render("status", {
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
                        } as delServer
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
                        } as delServer,
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
                        } as delServer
                    }
                });

                await serverCache.updateServer(req.params.id);

                res.redirect(`/servers/${req.params.id}`);
            })
            .catch((error: DiscordAPIError) => {
                if (error.code === RESTJSONErrorCodes.UnknownInvite)
                    return res.status(400).render("status", {
                        title: res.__("common.error"),
                        status: 400,
                        subtitle: res.__("common.error.listing.arr.invite.invalid"),
                        req,
                        type: "Error"
                    });

                return res.status(400).render("status", {
                    title: res.__("common.error"),
                    status: 400,
                    subtitle: `${error.name}: ${error.message} | ${error.code} ${error.method} ${error.url}`,
                    req,
                    type: "Error"
                });
            });
    }
);

export default router;

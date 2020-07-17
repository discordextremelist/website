/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020 Cairo Mitchell-Acason, John Burke, Advaith Jagathesan

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
import { Request, Response } from "express";

import * as fetch from "node-fetch";
import * as Discord from "discord.js";
import sanitizeHtml from "sanitize-html";

import * as settings from "../../settings.json";
import * as htmlRef from "../../htmlReference.json";
import * as discord from "../Util/Services/discord";
import * as permission from "../Util/Function/permissions";
import * as functions from "../Util/Function/main";
import * as userCache from "../Util/Services/userCaching";
import * as serverCache from "../Util/Services/serverCaching";
import { variables } from "../Util/Function/variables";
import * as tokenManager from "../Util/Services/adminTokenManager";

const md = require("markdown-it")();
const Entities = require("html-entities").XmlEntities;
const entities = new Entities();
const router = express.Router();

router.get(
    "/submit",
    variables,
    permission.auth,
    (req: Request, res: Response, next) => {
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
    async (req: Request, res: Response, next) => {
        res.locals.premidPageInfo = res.__("premid.servers.submit");

        let error = false;
        let errors: string[] = [];

        fetch(`https://discord.com/api/v6/invites/${req.body.invite}`, {
            method: "GET",
            headers: { Authorization: `Bot ${settings.secrets.discord.token}` }
        })
            .then(async (fetchRes) => {
                fetchRes.jsonBody = await fetchRes.json();

                if (fetchRes.jsonBody.code !== 10006) {
                    const serverExists:
                        | delServer
                        | undefined = await global.db
                        .collection("servers")
                        .findOne({ _id: fetchRes.jsonBody.guild.id });
                    if (serverExists)
                        return res.status(409).json({
                            error: true,
                            status: 409,
                            errors: [res.__("common.error.server.conflict")]
                        });

                    if (!req.body.longDescription) {
                        error = true;
                        errors.push(
                            res.__("common.error.listing.arr.longDescRequired")
                        );
                    }

                    if (!req.body.shortDescription) {
                        error = true;
                        errors.push(
                            res.__("common.error.listing.arr.shortDescRequired")
                        );
                    }
                } else {
                    error = true;
                    errors.push(
                        res.__("common.error.listing.arr.invite.invalid")
                    );
                }

                if (req.body.website && !/^https:\/\//.test(req.body.website)) {
                    error = true;
                    errors.push(
                        res.__("common.error.listing.arr.invalidURL.website")
                    );
                }

                if (
                    req.body.donationUrl &&
                    !/^https:\/\//.test(req.body.donationUrl)
                ) {
                    error = true;
                    errors.push(
                        res.__("common.error.listing.arr.invalidURL.donation")
                    );
                }

                let tags: string[] = [];

                if (req.body.gaming === true) tags.push("Gaming");
                if (req.body.music === true) tags.push("Music");
                if (req.body.mediaEntertain === "on")
                    tags.push("Media & Entertainment");
                if (req.body.createArts === true) tags.push("Creative Arts");
                if (req.body.sciTech === true) tags.push("Science & Tech");
                if (req.body.edu === true) tags.push("Education");
                if (req.body.fashBeaut === true) tags.push("Fashion & Beauty");

                if (req.body.relIdentity === "on")
                    tags.push("Relationships & Identity");
                if (req.body.travelCuis === true) tags.push("Travel & Food");
                if (req.body.fitHealth === true) tags.push("Fitness & Health");
                if (req.body.finance === true) tags.push("Finance");

                if (error === true)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: errors
                    });

                await global.db.collection("servers").insertOne({
                    _id: fetchRes.jsonBody.guild.id,
                    inviteCode: req.body.invite,
                    name: fetchRes.jsonBody.guild.name,
                    shortDesc: req.body.shortDescription,
                    longDesc: req.body.longDescription,
                    tags: tags,
                    owner: {
                        id: req.user.id
                    },
                    icon: {
                        hash: fetchRes.jsonBody.guild.icon,
                        url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.guild.id}/${fetchRes.jsonBody.guild.icon}`
                    },
                    links: {
                        invite: `https://discord.gg/${req.body.invite}`,
                        website: req.body.website,
                        donation: req.body.donationUrl
                    }
                });

                (discord.bot.channels.cache.get(
                    settings.channels.webLog
                ) as Discord.TextChannel).send(
                    `${settings.emoji.addBot} **${functions.escapeFormatting(
                        req.user.db.fullUsername
                    )}** \`(${
                        req.user.id
                    })\` added server **${functions.escapeFormatting(
                        fetchRes.jsonBody.guild.name
                    )}** \`(${fetchRes.jsonBody.guild.id})\`\n<${
                        settings.website.url
                    }/servers/${fetchRes.jsonBody.guild.id}>`
                );

                await global.db.collection("audit").insertOne({
                    type: "SUBMIT_SERVER",
                    executor: req.user.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: {
                            _id: fetchRes.jsonBody.guild.id,
                            inviteCode: req.body.invite,
                            name: fetchRes.jsonBody.guild.name,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            tags: tags,
                            owner: {
                                id: req.user.id
                            },
                            icon: {
                                hash: fetchRes.jsonBody.guild.icon,
                                url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.guild.id}/${fetchRes.jsonBody.guild.icon}`
                            },
                            links: {
                                invite: `https://discord.gg/${req.body.invite}`,
                                website: req.body.website,
                                donation: req.body.donationUrl
                            }
                        }
                    }
                });

                await serverCache.updateServer(fetchRes.jsonBody.guild.id);

                await discord.postWebMetric("server");

                return res.status(200).json({
                    error: false,
                    status: 200,
                    errors: []
                });
            })
            .catch(async (fetchRes) => {
                if (!req.body.invite) {
                    error = true;
                    errors.push(
                        res.__("common.error.listing.arr.invite.invalid")
                    );
                } else {
                    if (typeof req.body.invite !== "string") {
                        error = true;
                        errors.push(
                            res.__("common.error.listing.arr.invite.invalid")
                        );
                    } else if (req.body.invite.length > 2000) {
                        error = true;
                        errors.push(
                            res.__("common.error.listing.arr.invite.tooLong")
                        );
                    } else if (/^https:\/\//.test(req.body.invite)) {
                        error = true;
                        errors.push(
                            res.__("common.error.listing.arr.invite.isURL")
                        );
                    } else if (req.body.invite.includes("discord.gg")) {
                        error = true;
                        errors.push(
                            res.__("common.error.server.arr.invite.dgg")
                        );
                    }
                }

                if (!req.body.shortDescription) {
                    error = true;
                    errors.push(
                        res.__("common.error.listing.arr.shortDescRequired")
                    );
                }

                if (!req.body.longDescription) {
                    error = true;
                    errors.push(
                        res.__("common.error.listing.arr.longDescRequired")
                    );
                }

                let tags: string[] = [];

                if (req.body.gaming === true) tags.push("Gaming");
                if (req.body.music === true) tags.push("Music");
                if (req.body.mediaEntertain === "on")
                    tags.push("Media & Entertainment");
                if (req.body.createArts === true) tags.push("Creative Arts");
                if (req.body.sciTech === true) tags.push("Science & Tech");
                if (req.body.edu === true) tags.push("Education");
                if (req.body.fashBeaut === true) tags.push("Fashion & Beauty");

                if (req.body.relIdentity === "on")
                    tags.push("Relationships & Identity");
                if (req.body.travelCuis === true) tags.push("Travel & Food");
                if (req.body.fitHealth === true) tags.push("Fitness & Health");
                if (req.body.finance === true) tags.push("Finance");

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: errors
                });
            });
    }
);

router.get("/:id", variables, async (req: Request, res: Response, next) => {
    res.locals.pageType = {
        server: true,
        bot: false
    };

    let server: delServer | undefined = await serverCache.getServer(
        req.params.id
    );
    if (!server) {
        server = await global.db
            .collection("servers")
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

    let serverOwner: delUser | undefined = await userCache.getUser(
        server.owner.id
    );
    if (!serverOwner) {
        serverOwner = await global.db
            .collection("users")
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
        title: server.name,
        subtitle: server.shortDesc,
        server,
        longDesc: clean,
        serverOwner,
        webUrl: settings.website.url,
        req
    });
});

router.get(
    "/:id/src",
    variables,
    permission.auth,
    permission.admin,
    async (req: Request, res: Response, next) => {
        if (req.params.id === "@me") {
            if (!req.user) return res.redirect("/auth/login");
            req.params.id = req.user.id;
        }

        if (!req.query.token) return res.json({});

        const tokenCheck = await tokenManager.verifyToken(
            req.user.id,
            // @ts-ignore
            req.query.token
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
    async (req: Request, res: Response, next) => {
        const server: delServer | undefined = await global.db
            .collection("servers")
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

        res.render("templates/servers/edit", {
            title: res.__("page.servers.edit.title"),
            subtitle: res.__("page.servers.edit.subtitle", server.name),
            req,
            server
        });
    }
);

router.post(
    "/:id/edit",
    variables,
    permission.auth,
    async (req: Request, res: Response, next) => {
        let error = false;
        let errors: string[] = [];

        const server: delServer | undefined = await global.db
            .collection("servers")
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
            if (typeof req.body.invite !== "string") {
                error = true;
                errors.push(res.__("common.error.listing.arr.invite.invalid"));
            } else if (req.body.invite.length > 32) {
                error = true;
                errors.push(res.__("common.error.listing.arr.invite.tooLong"));
            } else if (/^https:\/\//.test(req.body.invite)) {
                error = true;
                errors.push(res.__("common.error.listing.arr.invite.isURL"));
            } else if (req.body.invite.includes("discord.gg")) {
                error = true;
                errors.push(res.__("common.error.server.arr.invite.dgg"));
            }
        }

        if (req.body.website && !/^https:\/\//.test(req.body.website)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.website"));
        }

        if (req.body.donationUrl && !/^https:\/\//.test(req.body.donationUrl)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.donation"));
        }

        if (!req.body.longDescription) {
            error = true;
            errors.push(res.__("common.error.listing.arr.longDescRequired"));
        }

        let tags: string[] = [];

        if (req.body.gaming === true) tags.push("Gaming");
        if (req.body.music === true) tags.push("Music");
        if (req.body.mediaEntertain === "on")
            tags.push("Media & Entertainment");
        if (req.body.createArts === true) tags.push("Creative Arts");
        if (req.body.sciTech === true) tags.push("Science & Tech");
        if (req.body.edu === true) tags.push("Education");
        if (req.body.fashBeaut === true) tags.push("Fashion & Beauty");

        if (req.body.relIdentity === "on")
            tags.push("Relationships & Identity");
        if (req.body.travelCuis === true) tags.push("Travel & Food");
        if (req.body.fitHealth === true) tags.push("Fitness & Health");
        if (req.body.finance === true) tags.push("Finance");

        fetch(`https://discord.com/api/v6/invites/${req.body.invite}`, {
            method: "GET",
            headers: { Authorization: `Bot ${settings.secrets.discord.token}` }
        })
            .then(async (fetchRes) => {
                fetchRes.jsonBody = await fetchRes.json();

                if (fetchRes.jsonBody.guild.id !== server._id) {
                    error = true;
                    errors.push(
                        res.__("common.error.server.arr.invite.sameServer")
                    );
                }

                if (error === true)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: errors
                    });

                await global.db.collection("servers").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            name: fetchRes.jsonBody.guild.name,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            inviteCode: req.body.invite,
                            tags: tags,
                            icon: {
                                hash: fetchRes.jsonBody.guild.icon,
                                url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.guild.id}/${fetchRes.jsonBody.guild.icon}`
                            },
                            links: {
                                invite: `https://discord.gg/${req.body.invite}`,
                                website: req.body.website,
                                donation: req.body.donationUrl
                            }
                        }
                    }
                );

                (discord.bot.channels.cache.get(
                    settings.channels.webLog
                ) as Discord.TextChannel).send(
                    `${settings.emoji.editBot} **${functions.escapeFormatting(
                        req.user.db.fullUsername
                    )}** \`(${
                        req.user.id
                    })\` edited server **${functions.escapeFormatting(
                        fetchRes.jsonBody.guild.name
                    )}** \`(${fetchRes.jsonBody.guild.id})\`\n<${
                        settings.website.url
                    }/servers/${fetchRes.jsonBody.guild.id}>`
                );

                await global.db.collection("audit").insertOne({
                    type: "EDIT_SERVER",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: {
                            name: fetchRes.jsonBody.guild.name,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            inviteCode: req.body.invite,
                            tags: tags,
                            icon: {
                                hash: fetchRes.jsonBody.guild.icon,
                                url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.guild.id}/${fetchRes.jsonBody.guild.icon}`
                            },
                            links: {
                                invite: `https://discord.gg/${req.body.invite}`,
                                website: req.body.website,
                                donation: req.body.donationUrl
                            }
                        },
                        old: {
                            name: server.name,
                            shortDesc: server.shortDesc,
                            longDesc: server.longDesc,
                            inviteCode: server.inviteCode,
                            tags: server.tags,
                            icon: {
                                hash: server.icon.hash,
                                url: server.icon.url
                            },
                            links: {
                                invite: server.links.invite,
                                website: server.links.website,
                                donation: server.links.donation
                            }
                        }
                    }
                });

                await serverCache.updateServer(req.params.id);

                return res.status(200).json({
                    error: false,
                    status: 200,
                    errors: []
                });
            })
            .catch(() => {
                return res.status(502).json({
                    error: true,
                    status: 502,
                    errors: [res.__("common.error.dapiFail")]
                });
            });
    }
);

router.get(
    "/:id/delete",
    variables,
    permission.auth,
    async (req: Request, res: Response, next) => {
        const server: delServer | undefined = await global.db
            .collection("servers")
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

        (discord.bot.channels.cache.get(
            settings.channels.webLog
        ) as Discord.TextChannel).send(
            `${settings.emoji.botDeleted} **${functions.escapeFormatting(
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
);

router.get(
    "/:id/remove",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response, next) => {
        const server: delServer | undefined = await global.db
            .collection("servers")
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
    async (req: Request, res: Response, next) => {
        const server: delServer | undefined = await global.db
            .collection("servers")
            .findOne({ _id: req.params.id });

        if (!server)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.server.404"),
                req,
                type: "Error"
            });

        await global.db.collection("servers").deleteOne({ _id: req.params.id });

        await global.db.collection("audit").insertOne({
            type: "REMOVE_SERVER",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified."
        });

        await serverCache.deleteServer(req.params.id);

        (discord.bot.channels.cache.get(
            settings.channels.webLog
        ) as Discord.TextChannel).send(
            `${settings.emoji.botDeleted} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` removed server **${functions.escapeFormatting(
                server.name
            )}** \`(${server._id})\`\n**Reason:** \`${req.body.reason}\``
        );

        const owner = discord.bot.users.cache.get(server.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.botDeleted
                    } **|** Your server **${functions.escapeFormatting(
                        server.name
                    )}** \`(${server._id})\` has been removed!\n**Reason:** \`${
                        req.body.reason
                    }\``
                )
                .catch((e: string) => {
                    console.error(e);
                });

        await discord.postWebMetric("server");

        res.redirect("/staff/queue");
    }
);

router.get(
    "/:id/sync",
    variables,
    permission.auth,
    async (req: Request, res: Response, next) => {
        let error = false;
        let errors: string[] = [];

        const server: delServer | undefined = await global.db
            .collection("servers")
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

        await fetch(`https://discord.com/api/v6/invites/${server.inviteCode}`, {
            method: "GET",
            headers: { Authorization: `Bot ${settings.secrets.discord.token}` }
        })
            .then(async (fetchRes) => {
                fetchRes.jsonBody = await fetchRes.json();

                if (fetchRes.jsonBody.guild.id !== server._id) {
                    error = true;
                    errors.push(
                        res.__("common.error.server.arr.invite.sameServer")
                    );
                }

                if (error === true) {
                    return res.status(404).render("status", {
                        title: res.__("common.error"),
                        status: 404,
                        subtitle: res.__("common.error.server.404"),
                        req,
                        type: "Error"
                    });
                }

                await global.db.collection("servers").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            name: fetchRes.jsonBody.guild.name,
                            icon: {
                                hash: fetchRes.jsonBody.guild.icon,
                                url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.guild.id}/${fetchRes.jsonBody.guild.icon}`
                            }
                        }
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
                            name: fetchRes.jsonBody.guild.name,
                            icon: {
                                hash: fetchRes.jsonBody.guild.icon,
                                url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.guild.id}/${fetchRes.jsonBody.guild.icon}`
                            }
                        },
                        old: {
                            name: server.name,
                            icon: {
                                hash: server.icon.hash,
                                url: server.icon.url
                            }
                        }
                    }
                });

                await serverCache.updateServer(req.params.id);

                res.redirect(`/servers/${req.params.id}`);
            })
            .catch(() => {
                return res.status(404).render("status", {
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.dapiFail"),
                    req,
                    type: "Error"
                });
            });
    }
);

export = router;

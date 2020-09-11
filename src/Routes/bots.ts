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
import { Response as fetchRes } from "../../@types/fetch";
import { APIUser, RESTJSONErrorCodes } from "discord-api-types/v6";

import * as fetch from "node-fetch";
import * as crypto from "crypto";
import * as Discord from "discord.js";
import sanitizeHtml from "sanitize-html";

import * as settings from "../../settings.json";
import * as htmlRef from "../../htmlReference.json";
import * as discord from "../Util/Services/discord";
import * as permission from "../Util/Function/permissions";
import * as functions from "../Util/Function/main";
import { variables } from "../Util/Function/variables";

import * as botCache from "../Util/Services/botCaching";
import * as userCache from "../Util/Services/userCaching";
import * as libraryCache from "../Util/Services/libCaching";
import * as tokenManager from "../Util/Services/adminTokenManager";
import { URL } from "url";
import { DiscordAPIError } from "discord.js";

const md = require("markdown-it")();
const Entities = require("html-entities").XmlEntities;
const entities = new Entities();
const router = express.Router();

router.get("/search", (req: Request, res: Response) => {
    res.redirect("/search");
});

router.get(
    "/submit",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        res.locals.premidPageInfo = res.__("premid.bots.submit");

        res.render("templates/bots/submit", {
            title: res.__("common.nav.me.submitBot"),
            subtitle: res.__("common.nav.me.submitBot.subtitle"),
            libraries: libraryCache.getLibs(),
            req,
            joinServerNotice: res.__("common.form.joinServer.full", {
                a:
                    '<a href="https://discord.gg/WeCer3J" rel="noopener" target="_blank">',
                ea: "</a>"
            })
        });
    }
);

router.post(
    "/submit",
    variables,
    permission.auth,
    permission.member,
    async (req: Request, res: Response) => {
        res.locals.premidPageInfo = res.__("premid.bots.submit");

        let error = false;
        let errors: string[] = [];

        let invite: string;

        const botExists = await global.db
            .collection("bots")
            .findOne({ _id: req.body.id });

        if (botExists)
            return res.status(409).json({
                error: true,
                status: 409,
                errors: [res.__("common.error.bot.conflict")]
            });

        if (!req.body.id) {
            error = true
            errors.push(res.__("common.error.listing.arr.IDRequired"))
        }

        if (isNaN(req.body.id) || req.body.id.includes(" ")) {
            error = true
            errors.push(res.__("common.error.bot.arr.invalidID"))
        }

        if (req.body.id.length > 32) {
            error = true
            errors.push(res.__("common.error.bot.arr.idTooLong"))
        }

        if (req.body.clientID) {
            if (isNaN(req.body.clientID) || req.body.clientID.includes(" ")) {
                error = true
                errors.push(res.__("common.error.bot.arr.invalidClientID"))
            }

            if (req.body.clientID && req.body.clientID.length > 32) {
                error = true
                errors.push(res.__("common.error.bot.arr.clientIDTooLong"))
            }
            
            await discord.bot.api.users(req.body.clientID).get()
                .then(() => {
                    error = true
                    errors.push(res.__("common.error.bot.arr.clientIDIsUser"))
                })
                .catch(() => {})
        }

        if (req.body.invite === "") {
            invite = `https://discord.com/api/oauth2/authorize?client_id=${
                req.body.clientID || req.body.id
            }&scope=bot`;
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
            } else if (!functions.isURL(req.body.invite)) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.invite.urlInvalid")
                );
            } else if (req.body.invite.includes("discordapp.com")) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.invite.discordapp")
                );
            } else {
                invite = req.body.invite;
            }
        }

        if (
            req.body.supportServer &&
            !functions.isURL(req.body.supportServer)
        ) {
            error = true;
            errors.push(
                res.__(
                    "common.error.listing.arr.invalidURL.supportServer"
                )
            );
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

        if (req.body.repo && !functions.isURL(req.body.repo)) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.invalidURL.repo")
            );
        }

        if (
            req.body.invite &&
            functions.isURL(req.body.invite) &&
            Number(
                new URL(req.body.invite).searchParams.get("permissions")
            ) & 8
        ) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.inviteHasAdmin")
            );
        }

        if (req.body.banner && !functions.isURL(req.body.banner)) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.invalidURL.banner")
            );
        }

        if (req.body.widgetServer && !req.body.widgetChannel) {
            error = true;
            errors.push(
                res.__(
                    "common.error.listing.arr.widgetbot.serverButNotChannel"
                )
            );
        }

        if (req.body.widgetChannel && !req.body.widgetServer) {
            error = true;
            errors.push(
                res.__(
                    "common.error.listing.arr.widgetbot.channelButNotServer"
                )
            );
        }

        if (req.body.widgetServer && req.body.widgetChannel) {
            let fetchServer = true;

            if (
                isNaN(req.body.widgetServer) ||
                req.body.widgetServer.includes(" ")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.widgetbot.serverID.invalid"
                    )
                );
                fetchServer = false;
            }
            if (
                req.body.widgetServer &&
                req.body.widgetServer.length > 32
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.widgetbot.serverID.tooLong"
                    )
                );
                fetchServer = false;
            }

            if (fetchServer)
                await discord.bot.api.guilds(req.body.widgetServer).channels.get()
                    .catch((e: DiscordAPIError) => {
                        if([400, 404].includes(e.httpStatus)) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.serverID.nonexistent"
                                )
                            );
                            fetchServer = false;
                        }
                    })

            if (fetchServer)
                await fetch(
                    `https://stonks.widgetbot.io/api/graphql?query={guild(id:"${req.body.widgetServer}"){id}}`
                ).then(async (fetchRes: fetchRes) => {
                    const { data } = await fetchRes.json();
                    if (data && !data.guild?.id) {
                        error = true;
                        errors.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.guildNotFound"
                            )
                        );
                    }
                });

            let fetchChannel = true;

            if (
                isNaN(req.body.widgetChannel) ||
                req.body.widgetChannel.includes(" ")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.widgetbot.channelID.invalid"
                    )
                );
                fetchChannel = false;
            }
            if (
                req.body.widgetChannel &&
                req.body.widgetChannel.length > 32
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.widgetbot.channelID.tooLong"
                    )
                );
                fetchChannel = false;
            }

            if (fetchChannel)
                await discord.bot.api.channels(req.body.widgetChannel).get()
                    .catch((e: DiscordAPIError) => {
                        if([400, 404].includes(e.httpStatus)) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.channelID.nonexistent"
                                )
                            );
                            fetchChannel = false;
                        }
                    })

            if (fetchChannel)
                await fetch(
                    `https://stonks.widgetbot.io/api/graphql?query={channel(id:"${req.body.widgetChannel}"){id}}`
                ).then(async (fetchRes: fetchRes) => {
                    const { data } = await fetchRes.json();
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

        if (req.body.twitter?.length > 15) {
            error = true;
            errors.push(res.__("common.error.bot.arr.twitterInvalid"))
        }

        if (!req.body.shortDescription) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.shortDescRequired")
            );
        } else if (req.body.shortDescription.length > 200) {
            error = true;
            errors.push(res.__("common.error.bot.arr.shortDescTooLong"))
        }

        if (!req.body.longDescription) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.longDescRequired")
            );
        } else {
            if (req.body.longDescription.length < 150) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.notAtMinChars", "150")
                );
            }

            if (req.body.longDescription.includes("http://")) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.containsHttp")
                )
            }
        }

        if (!req.body.prefix) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.prefixRequired")
            );
        } else if (req.body.prefix.length > 32) {
            error = true;
            errors.push(res.__("common.error.bot.arr.prefixTooLong"))
        }

        if (req.body.privacyPolicy) {
            if (req.body.privacyPolicy.length > 75) {
                error = true;
                errors.push(res.__("common.error.bot.arr.privacyTooLong"))
            }
            if (
                req.body.privacyPolicy.includes("discord.bot/privacy")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.privacyPolicy.placeholder"
                    )
                );
            }
            if (
                req.body.privacyPolicy.includes("discord.com/privacy")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.privacyPolicy.discord"
                    )
                );
            }
            if (/(yardım|yardim)/.test(req.body.privacyPolicy)) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.privacyPolicy.yardim"
                    )
                );
            }
            if (req.body.privacyPolicy.includes("help")) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.privacyPolicy.help"
                    )
                );
            }
        } else {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.privacyPolicyRequired")
            );
        }

        const library = libraryCache.hasLib(req.body.library)
            ? req.body.library
            : "Other";

        let tags: string[] = [];
        if (req.body.fun === true) tags.push("Fun");
        if (req.body.social === true) tags.push("Social");
        if (req.body.economy === true) tags.push("Economy");
        if (req.body.utility === true) tags.push("Utility");
        if (req.body.moderation === true) tags.push("Moderation");
        if (req.body.multipurpose === true) tags.push("Multipurpose");
        if (req.body.music === true) tags.push("Music");

        let editors: any[];

        if (req.body.editors !== "") {
            editors = [...new Set(req.body.editors.split(/\D+/g))];
        } else {
            editors = [];
        }

        if (editors.includes(req.user.id)) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.removeYourselfEditor")
            );
        }

        if (error === true)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });

        discord.bot.api.users(req.body.id).get()
            .then(async (bot: APIUser) => {
                if (!bot.bot)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.isUser")]
                    });

                await global.db.collection("bots").insertOne({
                    _id: req.body.id,
                    clientID: req.body.clientID,
                    name: bot.username,
                    prefix: req.body.prefix,
                    library: library,
                    tags: tags,
                    vanityUrl: "",
                    serverCount: 0,
                    shardCount: 0,
                    token:
                        "DELAPI_" +
                        crypto.randomBytes(16).toString("hex") +
                        `-${req.body.id}`,
                    flags: bot.public_flags,
                    shortDesc: req.body.shortDescription,
                    longDesc: req.body.longDescription,
                    modNotes: req.body.modNotes,
                    editors: editors,
                    owner: {
                        id: req.user.id
                    },
                    avatar: {
                        hash: bot.avatar,
                        url: `https://cdn.discordapp.com/avatars/${req.body.id}/${bot.avatar}`
                    },
                    votes: {
                        positive: [],
                        negative: []
                    },
                    links: {
                        invite: invite,
                        support: req.body.supportServer,
                        website: req.body.website,
                        donation: req.body.donationUrl,
                        repo: req.body.repo,
                        privacyPolicy: req.body.privacyPolicy
                    },
                    social: {
                        twitter: req.body.twitter
                    },
                    theme: {
                        useCustomColour: req.body.useCustomColour,
                        colour: req.body.colour,
                        banner: req.body.banner
                    },
                    widgetbot: {
                        channel: req.body.widgetChannel,
                        options: req.body.widgetOptions,
                        server: req.body.widgetServer
                    },
                    date: {
                        submitted: Date.now(),
                        approved: 0,
                        edited: 0
                    },
                    status: {
                        approved: false,
                        premium: false,
                        siteBot: false,
                        archived: false
                    }
                } as delBot);

                (discord.bot.channels.cache.get(
                    settings.channels.webLog
                ) as Discord.TextChannel).send(
                    `${settings.emoji.addBot} **${functions.escapeFormatting(
                        req.user.db.fullUsername
                    )}** \`(${
                        req.user.id
                    })\` added bot **${functions.escapeFormatting(
                        bot.username
                    )}** \`(${req.body.id})\`\n<${settings.website.url}/bots/${
                        req.body.id
                    }>`
                );

                await global.db.collection("audit").insertOne({
                    type: "SUBMIT_BOT",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: {
                            _id: req.body.id,
                            name: bot.username,
                            prefix: req.body.prefix,
                            library: library,
                            tags: tags,
                            flags: bot.public_flags,
                            vanityUrl: "",
                            serverCount: 0,
                            shardCount: 0,
                            token:
                                "DELAPI_" +
                                crypto.randomBytes(16).toString("hex") +
                                `-${req.body.id}`,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            modNotes: req.body.modNotes,
                            editors: editors,
                            owner: {
                                id: req.user.id
                            },
                            avatar: {
                                hash: bot.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.body.id}/${bot.avatar}`
                            },
                            votes: {
                                positive: [],
                                negative: []
                            },
                            links: {
                                invite: invite,
                                support: req.body.supportServer,
                                website: req.body.website,
                                donation: req.body.donationUrl,
                                repo: req.body.repo,
                                privacyPolicy: req.body.privacyPolicy
                            },
                            social: {
                                twitter: req.body.twitter
                            },
                            theme: {
                                useCustomColour: req.body.useCustomColour,
                                colour: req.body.colour,
                                banner: req.body.banner
                            },
                            widgetbot: {
                                channel: req.body.widgetChannel,
                                options: req.body.widgetOptions,
                                server: req.body.widgetServer
                            },
                            status: {
                                approved: false,
                                premium: false,
                                siteBot: false,
                                archived: false
                            }
                        } as delBot
                    }
                });
                await botCache.updateBot(req.params.id);

                await discord.postWebMetric("bot");

                return res.status(200).json({
                    error: false,
                    status: 200,
                    errors: []
                });
            })
            .catch((error: DiscordAPIError) => {
                if(error.code === RESTJSONErrorCodes.UnknownUser)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notFound")]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [res.__("common.error.bot.arr.fetchError"), `${error.name}: ${error.message}`, `${error.httpStatus} ${error.method} ${error.path}`]
                });
            });
    }
);

/* TODO: Add preview for long description on edit & submit page
router.post("/preview_post", async (req: Request, res: Response) => {
    const dirty = entities.decode(md.render(req.body.longDesc));

    const clean = sanitizeHtml(dirty, {
        allowedTags: [
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "blockquote",
            "button",
            "p",
            "a",
            "ul",
            "ol",
            "nl",
            "li",
            "b",
            "i",
            "img",
            "strong",
            "em",
            "strike",
            "code",
            "hr",
            "br",
            "div",
            "table",
            "thead",
            "caption",
            "tbody",
            "tr",
            "th",
            "td",
            "pre",
            "iframe",
            "style",
            "link"
        ],
        allowedAttributes: false,
        allowVulnerableTags: true
    });

    res.status(200).send(clean);
});*/

router.get(
    "/:id/tokenreset",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        const botExists = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });
        if (!botExists)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.404"),
                status: 404,
                type: "Error",
                req
            });

        if (
            botExists.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.perms.tokenReset"),
                status: 403,
                type: "Error",
                req
            });

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    token:
                        "DELAPI_" +
                        crypto.randomBytes(16).toString("hex") +
                        `-${req.params.id}`
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "RESET_BOT_TOKEN",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        return res.status(200).render("status", {
            title: res.__("common.success"),
            subtitle: res.__("common.success.bot.tokenReset"),
            status: 200,
            type: "Success",
            req
        });
    }
);

router.post(
    "/:id/setvanity",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        const botExists = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });
        if (!botExists)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.404"),
                status: 404,
                type: "Error",
                req
            });

        if (
            botExists.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.perms.vanity"),
                status: 403,
                type: "Error",
                req
            });

        if (
            req.body.vanity.includes(".") ||
            req.body.vanity.includes("/") ||
            req.body.vanity.includes("\\")
        )
            return res.status(400).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.vanity.blacklisted"),
                status: 400,
                type: "Error",
                req
            });

        const bots = await botCache.getAllBots();
        for (const bot of bots) {
            if (req.body.vanity === bot.vanityUrl)
                return res.status(409).render("status", {
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.conflict"),
                    status: 409,
                    type: "Error",
                    req
                });
        }

        if (botExists.vanityUrl) {
            if (req.body.vanity.split(" ").length !== 1)
                return res.status(400).render("status", {
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.tooLong"),
                    status: 400,
                    type: "Error",
                    req
                });

            if (req.body.vanity === botExists.vanityUrl)
                return res.status(400).render("status", {
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.same"),
                    status: 400,
                    type: "Error",
                    req
                });

            if (
                settings.website.bannedVanityURLs &&
                settings.website.bannedVanityURLs.includes(
                    req.body.vanity.toLowerCase()
                )
            )
                return res.status(400).render("status", {
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.blacklisted"),
                    status: 400,
                    type: "Error",
                    req
                });

            await global.db.collection("bots").updateOne(
                { _id: req.params.id },
                {
                    $set: {
                        vanityUrl: req.body.vanity.toLowerCase()
                    }
                }
            );

            await global.db.collection("audit").insertOne({
                type: "MODIFY_VANITY",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: req.body.reason || "None specified.",
                details: {
                    old: botExists.vanityUrl,
                    new: req.body.vanity
                }
            });
            await botCache.updateBot(req.params.id);

            res.redirect(`/bots/${req.params.id}`);
        } else if (!botExists.vanityUrl) {
            if (req.body.vanity.split(" ").length !== 1)
                return res.status(400).render("status", {
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.tooLong"),
                    status: 400,
                    type: "Error",
                    req
                });

            if (
                settings.website.bannedVanityURLs &&
                settings.website.bannedVanityURLs.includes(
                    req.body.vanity.toLowerCase()
                )
            )
                return res.status(400).render("status", {
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.blacklisted"),
                    status: 400,
                    type: "Error",
                    req
                });

            await global.db.collection("bots").updateOne(
                { _id: req.params.id },
                {
                    $set: {
                        vanityUrl: req.body.vanity.toLowerCase()
                    }
                }
            );

            await global.db.collection("audit").insertOne({
                type: "SET_VANITY",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: req.body.reason || "None specified.",
                details: {
                    old: "Not available.",
                    new: req.body.vanity
                }
            });
            await botCache.updateBot(req.params.id);

            res.redirect(`/bots/${req.params.id}`);
        }
    }
);

router.get(
    "/:id/edit",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        const botExists = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });
        if (!botExists)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.404"),
                status: 404,
                type: "Error",
                req
            });

        res.locals.premidPageInfo = res.__("premid.bots.edit", botExists.name);

        if (
            botExists.owner.id !== req.user.id &&
            !botExists.editors.includes(req.user.id) &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.perms.edit"),
                status: 403,
                type: "Error",
                req
            });

        const clean = sanitizeHtml(botExists.longDesc, {
            allowedTags: htmlRef.standard.tags,
            allowedAttributes: htmlRef.standard.attributes,
            allowVulnerableTags: true,
            disallowedTagsMode: "escape"
        });

        res.render("templates/bots/edit", {
            title: res.__("page.bots.edit.title"),
            subtitle: res.__("page.bots.edit.subtitle", botExists.name),
            libraries: libraryCache.getLibs(),
            bot: botExists,
            editors: botExists.editors ? botExists.editors.join(" ") : "",
            req,
            resubmit: false,
            longDesc: clean
        });
    }
);

router.post(
    "/:id/edit",
    variables,
    permission.auth,
    permission.member,
    async (req: Request, res: Response) => {
        let error = false;
        let errors = [];

        if (req.body.clientID) {
            if (isNaN(req.body.clientID) || req.body.clientID.includes(" ")) {
                error = true;
                errors.push(res.__("common.error.bot.arr.invalidClientID"));
            }
            if (req.body.clientID && req.body.clientID.length > 32) {
                error = true;
                errors.push(res.__("common.error.bot.arr.clientIDTooLong"));
            }
            if (req.body.clientID !== req.params.id)
                await discord.bot.api.users(req.body.clientID).get()
                    .then(() => {
                        error = true;
                        errors.push(
                            res.__("common.error.bot.arr.clientIDIsUser")
                        );
                    })
                    .catch(() => {})
        }

        const botExists: delBot | undefined = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!botExists)
            return res.status(404).json({
                error: true,
                status: 404,
                errors: [res.__("common.error.bot.404")]
            });

        res.locals.premidPageInfo = res.__("premid.bots.edit", botExists.name);

        const bot = botExists;
        if (
            bot.owner.id !== req.user.id &&
            !bot.editors.includes(req.user.id) &&
            req.user.db.rank.mod === false
        )
            return res.status(403).json({
                error: true,
                status: 403,
                errors: [res.__("common.error.bot.perms.edit")]
            });

        let invite: string;

        if (req.body.invite === "") {
            invite = `https://discord.com/api/oauth2/authorize?client_id=${
                req.body.clientID || req.params.id
            }&scope=bot`;
        } else {
            if (typeof req.body.invite !== "string") {
                error = true;
                errors.push(res.__("common.error.listing.arr.invite.invalid"));
            } else if (req.body.invite.length > 2000) {
                error = true;
                errors.push(res.__("common.error.listing.arr.invite.tooLong"));
            } else if (!functions.isURL(req.body.invite)) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.invite.urlInvalid")
                );
            } else if (req.body.invite.includes("discordapp.com")) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.invite.discordapp")
                );
            } else {
                invite = req.body.invite;
            }
        }

        if (
            req.body.supportServer &&
            !functions.isURL(req.body.supportServer)
        ) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.invalidURL.supportServer")
            );
        }

        if (req.body.website && !functions.isURL(req.body.website)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.website"));
        }

        if (req.body.donationUrl && !functions.isURL(req.body.donationUrl)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.donation"));
        }

        if (req.body.repo && !functions.isURL(req.body.repo)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.repo"));
        }

        if (req.body.banner && !functions.isURL(req.body.banner)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.banner"));
        }

        if (
            req.body.invite &&
            functions.isURL(req.body.invite) &&
            Number(new URL(req.body.invite).searchParams.get("permissions")) & 8
        ) {
            error = true;
            errors.push(res.__("common.error.listing.arr.inviteHasAdmin"));
        }

        if (req.body.widgetServer && !req.body.widgetChannel) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.widgetbot.serverButNotChannel")
            );
        }

        if (req.body.widgetChannel && !req.body.widgetServer) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.widgetbot.channelButNotServer")
            );
        }

        if (req.body.widgetServer && req.body.widgetChannel) {
            let fetchServer = true;

            if (
                isNaN(req.body.widgetServer) ||
                req.body.widgetServer.includes(" ")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.widgetbot.serverID.invalid"
                    )
                );
                fetchServer = false;
            }
            if (req.body.widgetServer && req.body.widgetServer.length > 32) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.widgetbot.serverID.tooLong"
                    )
                );
                fetchServer = false;
            }

            if (fetchServer)
                await discord.bot.api.guilds(req.body.widgetServer).channels.get()
                    .catch((e: DiscordAPIError) => {
                        if([400, 404].includes(e.httpStatus)) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.serverID.nonexistent"
                                )
                            );
                            fetchServer = false;
                        }
                    })

            if (fetchServer)
                await fetch(
                    `https://stonks.widgetbot.io/api/graphql?query={guild(id:"${req.body.widgetServer}"){id}}`
                ).then(async (fetchRes: fetchRes) => {
                    const { data } = await fetchRes.json();
                    if (data && !data.guild?.id) {
                        error = true;
                        errors.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.guildNotFound"
                            )
                        );
                    }
                });

            let fetchChannel = true;

            if (
                isNaN(req.body.widgetChannel) ||
                req.body.widgetChannel.includes(" ")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.widgetbot.channelID.invalid"
                    )
                );
                fetchChannel = false;
            }
            if (req.body.widgetChannel && req.body.widgetChannel.length > 32) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.widgetbot.channelID.tooLong"
                    )
                );
                fetchChannel = false;
            }

            if (fetchChannel)
                await discord.bot.api.channels(req.body.widgetChannel).get()
                    .catch((e: DiscordAPIError) => {
                        if([400, 404].includes(e.httpStatus)) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.channelID.nonexistent"
                                )
                            );
                            fetchChannel = false;
                        }
                    })

            if (fetchChannel)
                await fetch(
                    `https://stonks.widgetbot.io/api/graphql?query={channel(id:"${req.body.widgetChannel}"){id}}`
                ).then(async (fetchRes: fetchRes) => {
                    const { data } = await fetchRes.json();
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

        if (req.body.twitter?.length > 15) {
            error = true;
            errors.push(res.__("common.error.bot.arr.twitterInvalid"))
        }

        if (!req.body.shortDescription) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.shortDescRequired")
            );
        } else if (req.body.shortDescription.length > 200) {
            error = true;
            errors.push(res.__("common.error.bot.arr.shortDescTooLong"))
        }

        if (!req.body.longDescription) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.longDescRequired")
            );
        } else {
            if (req.body.longDescription.length < 150) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.notAtMinChars", "150")
                );
            }

            if (req.body.longDescription.includes("http://")) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.containsHttp")
                )
            }
        }

        if (!req.body.prefix) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.prefixRequired")
            );
        } else if (req.body.prefix.length > 32) {
            error = true;
            errors.push(res.__("common.error.bot.arr.prefixTooLong"))
        }

        if (req.body.privacyPolicy) {
            if (req.body.privacyPolicy.length > 75) {
                error = true;
                errors.push(res.__("common.error.bot.arr.privacyTooLong"))
            }
            if (
                req.body.privacyPolicy.includes("discord.bot/privacy")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.privacyPolicy.placeholder"
                    )
                );
            }

            if (
                req.body.privacyPolicy.includes("discord.com/privacy")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.privacyPolicy.discord"
                    )
                );
            }

            if (/(yardım|yardim)/.test(req.body.privacyPolicy)) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.privacyPolicy.yardim"
                    )
                );
            }

            if (req.body.privacyPolicy.includes("help")) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.privacyPolicy.help"
                    )
                );
            }
        } else {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.privacyPolicyRequired")
            );
        }

        let library = libraryCache.hasLib(req.body.library)
            ? req.body.library
            : "Other";
        let tags: string[] = [];

        if (req.body.fun === true) tags.push("Fun");
        if (req.body.social === true) tags.push("Social");
        if (req.body.economy === true) tags.push("Economy");
        if (req.body.utility === true) tags.push("Utility");
        if (req.body.moderation === true) tags.push("Moderation");
        if (req.body.multipurpose === true) tags.push("Multipurpose");
        if (req.body.music === true) tags.push("Music");

        let editors: any[];

        if (req.body.editors !== "") {
            editors = [...new Set(req.body.editors.split(/\D+/g))];
        } else {
            editors = [];
        }

        if (editors.includes(req.user.id)) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.removeYourselfEditor")
            );
        }

        if (error === true) {
            req.body.status
                ? (req.body.status.premium = botExists.status.premium)
                : (req.body.status = { premium: botExists.status.premium });

            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });
        }

        discord.bot.api.users(req.params.id).get()
            .then(async (bot: APIUser) => {
                await global.db.collection("bots").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            clientID: req.body.clientID,
                            name: bot.username,
                            prefix: req.body.prefix,
                            library: library,
                            tags: tags,
                            flags: bot.public_flags,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            editors: editors,
                            avatar: {
                                hash: bot.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.params.id}/${bot.avatar}`
                            },
                            links: {
                                invite: invite,
                                support: req.body.supportServer,
                                website: req.body.website,
                                donation: req.body.donationUrl,
                                repo: req.body.repo,
                                privacyPolicy: req.body.privacyPolicy
                            },
                            social: {
                                twitter: req.body.twitter
                            },
                            theme: {
                                useCustomColour: req.body.useCustomColour,
                                colour: req.body.colour,
                                banner: req.body.banner
                            },
                            widgetbot: {
                                channel: req.body.widgetChannel,
                                options: req.body.widgetOptions,
                                server: req.body.widgetServer
                            },
                            "date.edited": Date.now()
                        }
                    }
                );

                await global.db.collection("audit").insertOne({
                    type: "EDIT_BOT",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        old: {
                            clientID: botExists.clientID,
                            name: botExists.name,
                            prefix: botExists.prefix,
                            library: botExists.library,
                            tags: botExists.tags,
                            flags: botExists.flags,
                            shortDesc: botExists.shortDesc,
                            longDesc: botExists.longDesc,
                            editors: botExists.editors,
                            avatar: {
                                hash: botExists.avatar.hash,
                                url: botExists.avatar.url
                            },
                            links: {
                                invite: botExists.links.invite,
                                support: botExists.links.support,
                                website: botExists.links.website,
                                donation: botExists.links.donation,
                                repo: botExists.links.repo,
                                privacyPolicy: botExists.links.privacyPolicy
                            },
                            social: {
                                twitter: botExists.social?.twitter
                            },
                            theme: {
                                useCustomColour:
                                    botExists.theme.useCustomColour,
                                colour: botExists.theme.colour,
                                banner: botExists.theme.banner
                            },
                            widgetbot: {
                                channel: botExists.widgetbot.channel,
                                options: botExists.widgetbot.options,
                                server: botExists.widgetbot.server
                            }
                        } as delBot,
                        new: {
                            clientID: req.body.clientID,
                            name: bot.username,
                            prefix: req.body.prefix,
                            library: library,
                            tags: tags,
                            flags: bot.public_flags,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            editors: editors,
                            avatar: {
                                hash: bot.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.params.id}/${bot.avatar}`
                            },
                            links: {
                                invite: invite,
                                support: req.body.supportServer,
                                website: req.body.website,
                                donation: req.body.donationUrl,
                                repo: req.body.repo,
                                privacyPolicy: req.body.privacyPolicy
                            },
                            social: {
                                twitter: req.body.twitter
                            },
                            theme: {
                                useCustomColour: req.body.useCustomColour,
                                colour: req.body.colour,
                                banner: req.body.banner
                            },
                            widgetbot: {
                                channel: req.body.widgetChannel,
                                options: req.body.widgetOptions,
                                server: req.body.widgetServer
                            }
                        } as delBot
                    }
                });
                await botCache.updateBot(req.params.id);

                (discord.bot.channels.cache.get(
                    settings.channels.webLog
                ) as Discord.TextChannel)
                    .send(
                        `${settings.emoji.editBot} **${functions.escapeFormatting(
                            req.user.db.fullUsername
                        )}** \`(${
                            req.user.id
                        })\` edited bot **${functions.escapeFormatting(
                            bot.username
                        )}** \`(${bot.id})\`\n<${settings.website.url}/bots/${
                            req.params.id
                        }>`
                    )
                    .catch((e) => {
                        console.error(e);
                    });
        
                return res.status(200).json({
                    error: false,
                    status: 200,
                    errors: []
                });
            })
            .catch((error: DiscordAPIError) => {
                if(error.code === RESTJSONErrorCodes.UnknownUser)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notFound")]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [res.__("common.error.bot.arr.fetchError"), `${error.name}: ${error.message}`, `${error.httpStatus} ${error.method} ${error.path}`]
                });
            });
    }
);

router.get("/:id", variables, async (req: Request, res: Response) => {
    res.locals.pageType = {
        server: false,
        bot: true,
        template: false
    };

    let bot = await botCache.getBot(req.params.id);

    if (!bot) {
        bot = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });
        if (!bot) {
            bot = await global.db
                .collection("bots")
                .findOne({ vanityUrl: req.params.id });
            if (!bot)
                return res.status(404).render("status", {
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
                    type: "Error",
                    req: req,
                    pageType: { server: false, bot: false }
                });
        }
    }

    if (
        bot.status.archived &&
        req.user?.id !== bot.owner.id &&
        !req.user?.db.rank.mod
    )
        return res.status(403).render("status", {
            title: res.__("common.error"),
            status: 403,
            subtitle: res.__("common.error.bot.archived"),
            type: "Error",
            req: req,
            pageType: { server: false, bot: false }
        });

    res.locals.premidPageInfo = res.__("premid.bots.view", bot.name);

    let botOwner = await userCache.getUser(bot.owner.id);
    if (!botOwner) {
        botOwner = await global.db
            .collection("users")
            .findOne({ _id: bot.owner.id });
    }

    let botStatus = await discord.getStatus(bot._id);

    const dirty = entities.decode(md.render(bot.longDesc));
    let clean;
    if (bot.status.premium === true) {
        clean = sanitizeHtml(dirty, {
            allowedTags: htmlRef.trusted.tags,
            allowedAttributes: htmlRef.trusted.attributes,
            allowVulnerableTags: true
        });
    } else {
        clean = sanitizeHtml(dirty, {
            allowedTags: htmlRef.standard.tags,
            allowedAttributes: htmlRef.standard.attributes,
            allowVulnerableTags: true
        });
    }

    function sen(name: string) {
        return sanitizeHtml(name, {
            allowedTags: [],
            allowedAttributes: {},
            allowVulnerableTags: false
        });
    }

    let editors = "";
    let looped = 0;
    let editorsLength = bot.editors.length;

    for (const editor of bot.editors) {
        const user = await userCache.getUser(editor);
        looped += 1;

        if (user) {
            editorsLength !== looped
                ? (editors += `<a class="has-text-white" href="${
                      settings.website.url
                  }${res.locals.linkPrefix}/users/${user._id}">${
                      sen(user.fullUsername) || "Unknown#0000"
                  }</a>,&nbsp;`)
                : (editors += `<a class="has-text-white" href="${
                      settings.website.url
                  }${res.locals.linkPrefix}/users/${user._id}">${
                      sen(user.fullUsername) || "Unknown#0000"
                  }</a>`);
        } else {
            if (editorsLength === looped)
                editors = editors.substring(0, editors.length - 2);
        }
    }

    res.render("templates/bots/view", {
        title: bot.name,
        subtitle: bot.shortDesc,
        bot: bot,
        longDesc: clean,
        botOwner: botOwner,
        botStatus: botStatus,
        mainServer: settings.guild.main,
        staffServer: settings.guild.staff,
        webUrl: settings.website.url,
        req: req,
        editors,
        votes: bot.votes.positive.length - bot.votes.negative.length,
        functions,
        privacyIsURL: functions.isURL(bot.links.privacyPolicy)
    });
});

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

        const cache = await botCache.getBot(req.params.id);
        const db = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        return res.json({ cache: cache, db: db });
    }
);

router.get(
    "/:id/upvote",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        let bot = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot) {
            bot = await global.db
                .collection("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
                    type: "Error",
                    req: req
                });
        }

        let upVotes = [...bot.votes.positive];
        let downVotes = [...bot.votes.negative];

        if (upVotes.includes(req.user.id) || downVotes.includes(req.user.id)) {
            if (upVotes.includes(req.user.id)) {
                let removeUser = upVotes.indexOf(req.user.id);
                while (removeUser > -1) {
                    upVotes.splice(removeUser, 1);
                    removeUser = upVotes.indexOf(req.user.id);
                }
            }

            if (downVotes.includes(req.user.id)) {
                let removeUser = downVotes.indexOf(req.user.id);
                while (removeUser > -1) {
                    downVotes.splice(removeUser, 1);
                    removeUser = downVotes.indexOf(req.user.id);
                }

                upVotes.push(req.user.id);
            }
        } else {
            upVotes.push(req.user.id);
        }

        if (bot.votes.positive.includes(req.user.id)) {
            global.db.collection("audit").insertOne({
                type: "REMOVE_UPVOTE_BOT",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: "None specified.",
                details: {
                    old: {
                        votes: {
                            positive: bot.votes.positive,
                            negative: bot.votes.negative
                        }
                    },
                    new: {
                        votes: {
                            positive: upVotes,
                            negative: downVotes
                        }
                    }
                }
            });
        } else {
            global.db.collection("audit").insertOne({
                type: "UPVOTE_BOT",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: "None specified.",
                details: {
                    old: {
                        votes: {
                            positive: bot.votes.positive,
                            negative: bot.votes.negative
                        }
                    },
                    new: {
                        votes: {
                            positive: upVotes,
                            negative: downVotes
                        }
                    }
                }
            });
        }

        await global.db.collection("bots").updateOne(
            { _id: bot._id },
            {
                $set: {
                    votes: {
                        positive: upVotes,
                        negative: downVotes
                    }
                }
            }
        );

        await botCache.updateBot(bot._id);

        res.redirect(`/bots/${bot._id}`);
    }
);

router.get(
    "/:id/downvote",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        let bot = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot) {
            bot = await global.db
                .collection("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
                    type: "Error",
                    req: req
                });
        }

        let upVotes = [...bot.votes.positive];
        let downVotes = [...bot.votes.negative];

        if (upVotes.includes(req.user.id) || downVotes.includes(req.user.id)) {
            if (downVotes.includes(req.user.id)) {
                let removeUser = downVotes.indexOf(req.user.id);
                while (removeUser > -1) {
                    downVotes.splice(removeUser, 1);
                    removeUser = downVotes.indexOf(req.user.id);
                }
            }

            if (upVotes.includes(req.user.id)) {
                let removeUser = upVotes.indexOf(req.user.id);
                while (removeUser > -1) {
                    upVotes.splice(removeUser, 1);
                    removeUser = upVotes.indexOf(req.user.id);
                }

                downVotes.push(req.user.id);
            }
        } else {
            downVotes.push(req.user.id);
        }

        await global.db.collection("bots").updateOne(
            { _id: bot._id },
            {
                $set: {
                    votes: {
                        positive: upVotes,
                        negative: downVotes
                    }
                }
            }
        );

        if (bot.votes.negative.includes(req.user.id)) {
            global.db.collection("audit").insertOne({
                type: "REMOVE_DOWNVOTE_BOT",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: "None specified.",
                details: {
                    old: {
                        votes: {
                            positive: bot.votes.positive,
                            negative: bot.votes.negative
                        }
                    },
                    new: {
                        votes: {
                            positive: upVotes,
                            negative: downVotes
                        }
                    }
                }
            });
        } else {
            global.db.collection("audit").insertOne({
                type: "DOWNVOTE_BOT",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: "None specified.",
                details: {
                    old: {
                        votes: {
                            positive: bot.votes.positive,
                            negative: bot.votes.negative
                        }
                    },
                    new: {
                        votes: {
                            positive: upVotes,
                            negative: downVotes
                        }
                    }
                }
            });
        }

        await botCache.updateBot(bot._id);

        res.redirect(`/bots/${bot._id}`);
    }
);

router.get(
    "/:id/delete",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        let bot = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot) {
            bot = await global.db
                .collection("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
                    type: "Error",
                    req: req
                });
        }

        if (!req.user || req.user.id !== bot.owner.id)
            return res.status(403).render("status", {
                title: "Error",
                status: 403,
                message: res.__("common.error.bot.perms.notOwner"),
                user: req.user,
                req: req
            });

        (discord.bot.channels.cache.get(
            settings.channels.webLog
        ) as Discord.TextChannel).send(
            `${settings.emoji.botDeleted} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` deleted bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\``
        );

        await global.db.collection("bots").deleteOne({ _id: req.params.id });

        await global.db.collection("audit").insertOne({
            type: "DELETE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.deleteBot(req.params.id);

        await discord.postWebMetric("bot");

        res.redirect("/users/@me");
    }
);

router.get(
    "/:id/resubmit",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        const botExists = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });
        if (!botExists)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.404"),
                status: 404,
                type: "Error",
                req
            });

        if (botExists.status.archived === false)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.notArchived"),
                status: 400,
                type: "Error",
                req
            });

        if (
            botExists.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.perms.resubmit"),
                status: 403,
                type: "Error",
                req
            });

        res.locals.premidPageInfo = res.__(
            "premid.bots.resubmit",
            botExists.name
        );

        res.render("templates/bots/edit", {
            title: res.__("page.bots.resubmit.title"),
            subtitle: res.__("page.bots.resubmit.subtitle", botExists.name),
            libraries: libraryCache.getLibs(),
            bot: botExists,
            editors: botExists.editors ? botExists.editors.join(" ") : "",
            req,
            resubmit: true,
            longDesc: botExists.longDesc
        });
    }
);

router.post(
    "/:id/resubmit",
    variables,
    permission.auth,
    permission.member,
    async (req: Request, res: Response) => {
        let error = false;
        let errors = [];

        if (req.body.clientID) {
            if (isNaN(req.body.clientID) || req.body.clientID.includes(" "))
                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [res.__("common.error.bot.arr.invalidClientID")]
                });

            if (req.body.clientID && req.body.clientID.length > 32)
                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [res.__("common.error.bot.arr.clientIDTooLong")]
                });

            if (req.body.clientID !== req.params.id)
                await discord.bot.api.users(req.body.clientID).get()
                    .then(() => {
                        error = true
                        return res.status(400).json({
                            error: true,
                            status: 400,
                            errors: [res.__("common.error.bot.arr.clientIDIsUser")]
                        });
                    })
                    .catch(() => {})
        }

        const botExists: delBot | undefined = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!botExists)
            return res.status(404).json({
                error: true,
                status: 404,
                errors: [res.__("common.error.bot.404")]
            });

        if (botExists.status.archived === false)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: [res.__("common.error.bot.notArchived")]
            });

        const bot = botExists;
        if (
            bot.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).json({
                error: true,
                status: 403,
                errors: [res.__("common.error.bot.perms.resubmit")]
            });

        res.locals.premidPageInfo = res.__(
            "premid.bots.resubmit",
            botExists.name
        );

        let invite: string;

        if (req.body.invite === "") {
            invite = `https://discord.com/api/oauth2/authorize?client_id=${
                req.body.clientID || req.params.id
            }&scope=bot`;
        } else {
            if (typeof req.body.invite !== "string") {
                error = true;
                errors.push(res.__("common.error.listing.arr.invite.invalid"));
            } else if (req.body.invite.length > 2000) {
                error = true;
                errors.push(res.__("common.error.listing.arr.invite.tooLong"));
            } else if (!functions.isURL(req.body.invite)) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.invite.urlInvalid")
                );
            } else if (req.body.invite.includes("discordapp.com")) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.invite.discordapp")
                );
            } else {
                invite = req.body.invite;
            }
        }

        if (
            req.body.supportServer &&
            !functions.isURL(req.body.supportServer)
        ) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.invalidURL.supportServer")
            );
        }

        if (req.body.website && !functions.isURL(req.body.website)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.website"));
        }

        if (req.body.donationUrl && !functions.isURL(req.body.donationUrl)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.donation"));
        }

        if (req.body.repo && !functions.isURL(req.body.repo)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.repo"));
        }

        if (req.body.banner && !functions.isURL(req.body.banner)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.banner"));
        }

        if (
            req.body.invite &&
            functions.isURL(req.body.invite) &&
            Number(new URL(req.body.invite).searchParams.get("permissions")) & 8
        ) {
            error = true;
            errors.push(res.__("common.error.listing.arr.inviteHasAdmin"));
        }

        if (req.body.widgetServer && !req.body.widgetChannel) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.widgetbot.serverButNotChannel")
            );
        }

        if (req.body.widgetChannel && !req.body.widgetServer) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.widgetbot.channelButNotServer")
            );
        }

        if (req.body.widgetServer && req.body.widgetChannel) {
            let fetchServer = true;

            if (
                isNaN(req.body.widgetServer) ||
                req.body.widgetServer.includes(" ")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.widgetbot.serverID.invalid"
                    )
                );
                fetchServer = false;
            }
            if (req.body.widgetServer && req.body.widgetServer.length > 32) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.widgetbot.serverID.tooLong"
                    )
                );
                fetchServer = false;
            }

            if (fetchServer)
                await discord.bot.api.guilds(req.body.widgetServer).channels.get()
                    .catch((e: DiscordAPIError) => {
                        if([400, 404].includes(e.httpStatus)) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.serverID.nonexistent"
                                )
                            );
                            fetchServer = false;
                        }
                    })

            if (fetchServer)
                await fetch(
                    `https://stonks.widgetbot.io/api/graphql?query={guild(id:"${req.body.widgetServer}"){id}}`
                ).then(async (fetchRes: fetchRes) => {
                    const { data } = await fetchRes.json();
                    if (data && !data.guild?.id) {
                        error = true;
                        errors.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.guildNotFound"
                            )
                        );
                    }
                });

            let fetchChannel = true;

            if (
                isNaN(req.body.widgetChannel) ||
                req.body.widgetChannel.includes(" ")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.widgetbot.channelID.invalid"
                    )
                );
                fetchChannel = false;
            }
            if (req.body.widgetChannel && req.body.widgetChannel.length > 32) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.widgetbot.channelID.tooLong"
                    )
                );
                fetchChannel = false;
            }

            if (fetchChannel)
                await discord.bot.api.channels(req.body.widgetChannel).get()
                    .catch((e: DiscordAPIError) => {
                        if([400, 404].includes(e.httpStatus)) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.channelID.nonexistent"
                                )
                            );
                            fetchChannel = false;
                        }
                    })

            if (fetchChannel)
                await fetch(
                    `https://stonks.widgetbot.io/api/graphql?query={channel(id:"${req.body.widgetChannel}"){id}}`
                ).then(async (fetchRes: fetchRes) => {
                    const { data } = await fetchRes.json();
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

        if (req.body.twitter?.length > 15) {
            error = true;
            errors.push(res.__("common.error.bot.arr.twitterInvalid"))
        }

        if (!req.body.shortDescription) {
            error = true;
            errors.push(res.__("common.error.listing.arr.shortDescRequired"));
        } else if (req.body.shortDescription.length > 200) {
            error = true;
            errors.push(res.__("common.error.bot.arr.shortDescTooLong"))
        }

        if (!req.body.longDescription) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.longDescRequired")
            );
        } else {
            if (req.body.longDescription.length < 150) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.notAtMinChars", "150")
                );
            }

            if (req.body.longDescription.includes("http://")) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.containsHttp")
                )
            }
        }

        if (!req.body.prefix) {
            error = true;
            errors.push(res.__("common.error.listing.arr.prefixRequired"));
        } else if (req.body.prefix.length > 32) {
            error = true;
            errors.push(res.__("common.error.bot.arr.prefixTooLong"))
        }

        if (req.body.privacyPolicy) {
            if (req.body.privacyPolicy.length > 75) {
                error = true;
                errors.push(res.__("common.error.bot.arr.privacyTooLong"))
            }
            if (
                req.body.privacyPolicy.includes("discord.bot/privacy")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.privacyPolicy.placeholder"
                    )
                );
            }

            if (
                req.body.privacyPolicy.includes("discord.com/privacy")
            ) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.privacyPolicy.discord"
                    )
                );
            }

            if (/(yardım|yardim)/.test(req.body.privacyPolicy)) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.privacyPolicy.yardim"
                    )
                );
            }

            if (req.body.privacyPolicy.includes("help")) {
                error = true;
                errors.push(
                    res.__(
                        "common.error.listing.arr.privacyPolicy.help"
                    )
                );
            }
        } else {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.privacyPolicyRequired")
            );
        }

        const library = libraryCache.hasLib(req.body.library)
            ? req.body.library
            : "Other";
        let tags: string[] = [];
        if (req.body.fun === true) tags.push("Fun");
        if (req.body.social === true) tags.push("Social");
        if (req.body.economy === true) tags.push("Economy");
        if (req.body.utility === true) tags.push("Utility");
        if (req.body.moderation === true) tags.push("Moderation");
        if (req.body.multipurpose === true) tags.push("Multipurpose");
        if (req.body.music === true) tags.push("Music");

        let editors: any[];

        if (req.body.editors !== "") {
            editors = [...new Set(req.body.editors.split(/\D+/g))];
        } else {
            editors = [];
        }

        if (editors.includes(req.user.id)) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.removeYourselfEditor")
            );
        }

        if (error === true)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });

        discord.bot.api.users(req.params.id).get()
            .then(async (bot: APIUser) => {
                await global.db.collection("bots").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            clientID: req.body.clientID,
                            name: bot.username,
                            prefix: req.body.prefix,
                            library: library,
                            tags: tags,
                            flags: bot.public_flags,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            editors: editors,
                            avatar: {
                                hash: bot.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.params.id}/${bot.avatar}`
                            },
                            links: {
                                invite: invite,
                                support: req.body.supportServer,
                                website: req.body.website,
                                donation: req.body.donationUrl,
                                repo: req.body.repo,
                                privacyPolicy: req.body.privacyPolicy
                            },
                            date: {
                                submitted: Date.now(),
                                approved: 0,
                                edited: 0
                            },
                            "status.archived": false
                        }
                    }
                );

                await global.db.collection("audit").insertOne({
                    type: "RESUBMIT_BOT",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        old: {
                            clientID: botExists.clientID,
                            name: botExists.name,
                            prefix: botExists.prefix,
                            library: botExists.library,
                            tags: botExists.tags,
                            flags: botExists.flags,
                            shortDesc: botExists.shortDesc,
                            longDesc: botExists.longDesc,
                            editors: botExists.editors,
                            avatar: {
                                hash: botExists.avatar.hash,
                                url: botExists.avatar.url
                            },
                            links: {
                                invite: botExists.links.invite,
                                support: botExists.links.support,
                                website: botExists.links.website,
                                donation: botExists.links.donation,
                                repo: botExists.links.repo,
                                privacyPolicy: botExists.links.privacyPolicy
                            },
                            social: {
                                twitter: botExists.social?.twitter
                            },
                            theme: {
                                useCustomColour:
                                    botExists.theme.useCustomColour,
                                colour: botExists.theme.colour,
                                banner: botExists.theme.banner
                            },
                            widgetbot: {
                                channel: botExists.widgetbot.channel,
                                options: botExists.widgetbot.options,
                                server: botExists.widgetbot.server
                            },
                            status: {
                                archived: true
                            }
                        } as delBot,
                        new: {
                            clientID: req.body.clientID,
                            name: bot.username,
                            prefix: req.body.prefix,
                            library: library,
                            tags: tags,
                            flags: bot.public_flags,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            editors: editors,
                            avatar: {
                                hash: bot.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.params.id}/${bot.avatar}`
                            },
                            links: {
                                invite: invite,
                                support: req.body.supportServer,
                                website: req.body.website,
                                donation: req.body.donationUrl,
                                repo: req.body.repo,
                                privacyPolicy: req.body.privacyPolicy
                            },
                            social: {
                                twitter: req.body.twitter
                            },
                            theme: {
                                useCustomColour: req.body.useCustomColour,
                                colour: req.body.colour,
                                banner: req.body.banner
                            },
                            widgetbot: {
                                channel: req.body.widgetChannel,
                                options: req.body.widgetOptions,
                                server: req.body.widgetServer
                            },
                            status: {
                                archived: false
                            }
                        } as delBot
                    }
                });
                await botCache.updateBot(req.params.id);

                (discord.bot.channels.cache.get(
                    settings.channels.webLog
                ) as Discord.TextChannel)
                    .send(
                        `${settings.emoji.resubmitBot} **${functions.escapeFormatting(
                            req.user.db.fullUsername
                        )}** \`(${
                            req.user.id
                        })\` resubmitted bot **${functions.escapeFormatting(
                            bot.username
                        )}** \`(${bot.id})\`\n<${settings.website.url}/bots/${
                            bot.id
                        }>`
                    )
                    .catch((e) => {
                        console.error(e);
                    });
        
                return res.status(200).json({
                    error: false,
                    status: 200,
                    errors: []
                });
            })
            .catch((error: DiscordAPIError) => {
                if(error.code === RESTJSONErrorCodes.UnknownUser)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notFound")]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [res.__("common.error.bot.arr.fetchError"), `${error.name}: ${error.message}`, `${error.httpStatus} ${error.method} ${error.path}`]
                });
            });
    }
);

router.get(
    "/:id/approve",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const bot: delBot | undefined = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.bot.error.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === true)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.alreadyApproved"),
                req,
                type: "Error"
            });

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.approved": true,
                    "date.approved": Date.now()
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    "staffTracking.handledBots.allTime.total": req.user.db.staffTracking.handledBots.allTime.total += 1,
                    "staffTracking.handledBots.allTime.approved": req.user.db.staffTracking.handledBots.allTime.approved += 1,
                    "staffTracking.handledBots.thisWeek.total": req.user.db.staffTracking.handledBots.thisWeek.total += 1,
                    "staffTracking.handledBots.thisWeek.approved": req.user.db.staffTracking.handledBots.thisWeek.approved += 1
                }
            }
        );

        (discord.bot.channels.cache.get(
            settings.channels.webLog
        ) as Discord.TextChannel)
            .send(
                `${settings.emoji.check} **${functions.escapeFormatting(
                    req.user.db.fullUsername
                )}** \`(${
                    req.user.id
                })\` approved bot **${functions.escapeFormatting(
                    bot.name
                )}** \`(${bot._id})\`\n<${settings.website.url}/bots/${
                    bot._id
                }>`
            )
            .catch((e) => {
                console.error(e);
            });

        const owner = discord.bot.users.cache.get(bot.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.check
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been approved on the website!

Your bot will be added to our server within the next 24 hours.`
                )
                .catch((e) => {
                    console.error(e);
                });

        const mainGuild = discord.bot.guilds.cache.get(settings.guild.main);
        const staffGuild = discord.bot.guilds.cache.get(settings.guild.staff);

        const mainGuildOwner = mainGuild.members.cache.get(bot.owner.id);
        if (mainGuildOwner)
            mainGuildOwner.roles
                .add(settings.roles.developer, "User's bot was just approved.")
                .catch((e) => {
                    console.error(e);
                    discord.alertsChannel.send(
                        `${settings.emoji.error} Failed giving <@${bot.owner.id}> \`${bot.owner.id}\` the role **Bot Developer** upon one of their bots being approved.`
                    );
                });

        const mainGuildBot = mainGuild.members.cache.get(bot._id);
        if (mainGuildBot)
            mainGuildBot.roles
                .add(settings.roles.bot, "Bot was approved on the website.")
                .catch((e) => {
                    console.error(e);
                    discord.alertsChannel.send(
                        `${settings.emoji.error} Failed giving <@${bot._id}> \`${bot._id}\` the role **Bot** upon being approved on the website.`
                    );
                });

        const botStaffServer = staffGuild.members.cache.get(bot._id);
        if (botStaffServer)
            botStaffServer
                .kick("Bot was approved on the website.")
                .catch((e) => {
                    console.error(e);
                    discord.alertsChannel.send(
                        `${settings.emoji.error} Failed kicking <@${bot._id}> \`${bot._id}\` from the Staff Server on approval.`
                    );
                });

        global.db.collection("audit").insertOne({
            type: "APPROVE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${req.params.id}`);
    }
);

router.get(
    "/:id/give-premium",
    variables,
    permission.auth,
    permission.assistant,
    async (req: Request, res: Response) => {
        const bot: delBot | undefined = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.bot.error.404"),
                req,
                type: "Error"
            });

        if (bot.status.premium === true)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.alreadyPremium"),
                req,
                type: "Error"
            });

        const mainGuild = await discord.bot.guilds.cache.get(
            settings.guild.main
        );
        const botMember = await mainGuild.members.cache.get(bot._id);

        if (botMember)
            botMember.roles
                .add(
                    settings.roles.premiumBot,
                    "Bot was given premium on the website."
                )
                .catch((e) => {
                    console.error(e);
                    discord.alertsChannel.send(
                        `${settings.emoji.error} Failed giving <@${botMember.id}> \`${botMember.id}\` the role **Premium Bot** upon being given premium on the website.`
                    );
                });

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.premium": true
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: bot.owner.id },
            {
                $set: {
                    "status.premium": true
                }
            }
        );

        await botCache.updateBot(req.params.id);

        global.db.collection("audit").insertOne({
            type: "PREMIUM_BOT_GIVE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        res.redirect(`/bots/${req.params.id}`);
    }
);

router.get(
    "/:id/take-premium",
    variables,
    permission.auth,
    permission.assistant,
    async (req: Request, res: Response) => {
        const bot: delBot | undefined = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.premium === false)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.noPremiumTake"),
                req,
                type: "Error"
            });

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.premium": false
                }
            }
        );

        await botCache.updateBot(req.params.id);

        global.db.collection("audit").insertOne({
            type: "PREMIUM_BOT_TAKE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        res.redirect(`/bots/${req.params.id}`);
    }
);

router.get(
    "/:id/decline",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const bot: delBot | undefined = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__("premid.bots.decline", bot.name);

        if (bot.status.approved === true)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.notInQueue"),
                req,
                type: "Error"
            });

        let redirect = `/bots/${bot._id}`;

        if (req.query.from && req.query.from === "queue")
            redirect = "/staff/bot_queue";

        res.render("templates/bots/staffActions/remove", {
            title: res.__("page.bots.decline.title"),
            icon: "times",
            subtitle: res.__("page.bots.decline.subtitle", bot.name),
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
        const bot: delBot | undefined = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === true)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.notInQueue"),
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

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    vanityUrl: "",
                    "status.archived": true
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    "staffTracking.handledBots.allTime.total": req.user.db.staffTracking.handledBots.allTime.total += 1,
                    "staffTracking.handledBots.allTime.declined": req.user.db.staffTracking.handledBots.allTime.declined += 1,
                    "staffTracking.handledBots.thisWeek.total": req.user.db.staffTracking.handledBots.thisWeek.total += 1,
                    "staffTracking.handledBots.thisWeek.declined": req.user.db.staffTracking.handledBots.thisWeek.declined += 1
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "DECLINE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified."
        });

        await botCache.updateBot(req.params.id);

        (discord.bot.channels.cache.get(
            settings.channels.webLog
        ) as Discord.TextChannel).send(
            `${settings.emoji.cross} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` declined bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\`\n**Reason:** \`${req.body.reason || "None specified."}\`\n<${
                settings.website.url
            }/bots/${bot._id}>`
        );

        const staffGuild = discord.bot.guilds.cache.get(settings.guild.staff);

        const member = staffGuild.members.cache.get(req.params.id);

        if (member && !settings.website.dev) {
            await member.kick("Bot's listing has been declined.").catch((e) => {
                console.error(e);
            });
        }

        const owner = discord.bot.users.cache.get(bot.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.cross
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been declined.\n**Reason:** \`${
                        req.body.reason || "None specified."
                    }\``
                )
                .catch((e) => {
                    console.error(e);
                });

        res.redirect("/staff/bot_queue");
    }
);

router.get(
    "/:id/unapprove",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const bot: delBot | undefined = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (!bot.status.approved)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.alreadyNotApproved"),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__("premid.bots.unapprove", bot.name);

        res.render("templates/bots/staffActions/remove", {
            title: res.__("page.bots.unapprove.title"),
            icon: "minus",
            subtitle: res.__("page.bots.unapprove.subtitle", bot.name),
            req,
            redirect: `/bots/${bot._id}`
        });
    }
);

router.post(
    "/:id/unapprove",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const bot: delBot | undefined = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (!bot.status.approved)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueue"),
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

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    vanityUrl: "",
                    "status.approved": false,
                    "date.approved": null
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    "staffTracking.handledBots.allTime.total": req.user.db.staffTracking.handledBots.allTime.total += 1,
                    "staffTracking.handledBots.allTime.unapprove": req.user.db.staffTracking.handledBots.allTime.unapprove += 1,
                    "staffTracking.handledBots.thisWeek.total": req.user.db.staffTracking.handledBots.thisWeek.total += 1,
                    "staffTracking.handledBots.thisWeek.unapprove": req.user.db.staffTracking.handledBots.thisWeek.unapprove += 1
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "UNAPPROVE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified."
        });

        await botCache.updateBot(req.params.id);

        (discord.bot.channels.cache.get(
            settings.channels.webLog
        ) as Discord.TextChannel).send(
            `${settings.emoji.unapprove} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` unapproved bot **${functions.escapeFormatting(
                bot.name
            )}** \`(${bot._id})\`\n**Reason:** \`${
                req.body.reason || "None specified."
            }\`\n<${settings.website.url}/bots/${bot._id}>`
        );

        const mainGuild = discord.bot.guilds.cache.get(settings.guild.main);

        const member = mainGuild.members.cache.get(req.params.id);

        if (member && !settings.website.dev) {
            await member.kick("Bot has been unapproved.").catch((e) => {
                console.error(e);
            });
        }

        const owner = discord.bot.users.cache.get(bot.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.unapprove
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been unapproved!\n**Reason:** \`${
                        req.body.reason || "None specified."
                    }\``
                )
                .catch((e) => {
                    console.error(e);
                });

        res.redirect(`/bots/${bot._id}`);
    }
);

router.get(
    "/:id/remove",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const bot: delBot | undefined = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === false)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueue"),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__("premid.bots.remove", bot.name);

        res.render("templates/bots/staffActions/remove", {
            title: res.__("page.bots.remove.title"),
            icon: "trash",
            subtitle: res.__("page.bots.remove.subtitle", bot.name),
            req,
            redirect: `/bots/${bot._id}`
        });
    }
);

router.post(
    "/:id/remove",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const bot: delBot | undefined = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === false)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueue"),
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

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    vanityUrl: "",
                    "status.archived": true,
                    "status.approved": false
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    "staffTracking.handledBots.allTime.total": req.user.db.staffTracking.handledBots.allTime.total += 1,
                    "staffTracking.handledBots.allTime.remove": req.user.db.staffTracking.handledBots.allTime.remove += 1,
                    "staffTracking.handledBots.thisWeek.total": req.user.db.staffTracking.handledBots.thisWeek.total += 1,
                    "staffTracking.handledBots.thisWeek.remove": req.user.db.staffTracking.handledBots.thisWeek.remove += 1
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "REMOVE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified."
        });

        await botCache.updateBot(req.params.id);

        (discord.bot.channels.cache.get(
            settings.channels.webLog
        ) as Discord.TextChannel).send(
            `${settings.emoji.botDeleted} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` removed bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\`\n**Reason:** \`${req.body.reason || "None specified."}\`\n<${
                settings.website.url
            }/bots/${bot._id}>`
        );

        const mainGuild = discord.bot.guilds.cache.get(settings.guild.main);

        const member = mainGuild.members.cache.get(req.params.id);

        if (member && !settings.website.dev) {
            await member
                .kick("Bot has been removed from the website.")
                .catch((e) => {
                    console.error(e);
                });
        }

        const owner = discord.bot.users.cache.get(bot.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.botDeleted
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been removed!\n**Reason:** \`${
                        req.body.reason || "None specified."
                    }\``
                )
                .catch((e) => {
                    console.error(e);
                });

        res.redirect(`/bots/${bot._id}`);
    }
);

router.get(
    "/:id/sync",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        const botExists: delBot | undefined = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!botExists)
            return res.status(404).json({
                error: true,
                status: 404,
                errors: [res.__("common.error.bot.404")]
            });

        const bot = botExists;

        discord.bot.api.users(req.params.id).get()
            .then(async (bot: APIUser) => {
                await global.db.collection("bots").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            name: bot.username,
                            flags: bot.public_flags,
                            avatar: {
                                hash: bot.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.params.id}/${bot.avatar}`
                            }
                        } as delBot
                    }
                );

                await global.db.collection("audit").insertOne({
                    type: "SYNC_BOT",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        old: {
                            name: botExists.name,
                            flags: botExists.flags,
                            avatar: {
                                hash: botExists.avatar.hash,
                                url: botExists.avatar.url
                            }
                        } as delBot,
                        new: {
                            name: bot.username,
                            flags: bot.public_flags,
                            avatar: {
                                hash: bot.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.params.id}/${bot.avatar}`
                            }
                        } as delBot
                    }
                });
                await botCache.updateBot(req.params.id);
            })
            .catch((error: DiscordAPIError) => {
                if(error.code === RESTJSONErrorCodes.UnknownUser)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notFound")]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [res.__("common.error.bot.arr.fetchError"), `${error.name}: ${error.message}`, `${error.httpStatus} ${error.method} ${error.path}`]
                });
            });

        res.redirect(`/bots/${bot._id}`);
    }
);

export = router;

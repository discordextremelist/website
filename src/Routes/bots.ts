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

import express from "express";
import type { Request, Response } from "express";
import type {
    APIApplication,
    APIApplicationCommand,
    APIUser,
    RESTPostOAuth2AccessTokenResult
} from "discord.js";
import {
    OAuth2Scopes,
    RESTJSONErrorCodes,
    Routes,
    PresenceUpdateStatus,
    UserFlags
} from "discord.js";
import fetch from "node-fetch";
import * as crypto from "crypto";
import * as Discord from "discord.js";
import sanitizeHtml from "sanitize-html";
import refresh from "passport-oauth2-refresh";

import settings from "../../settings.json" with { type: "json" };
import htmlRef from "../../htmlReference.json" with { type: "json" };
import * as discord from "../Util/Services/discord.ts";
import * as permission from "../Util/Function/permissions.ts";
import * as checks from "../Util/Function/checks.ts";
import * as functions from "../Util/Function/main.ts";
import { variables } from "../Util/Function/variables.ts";

import * as botCache from "../Util/Services/botCaching.ts";
import * as userCache from "../Util/Services/userCaching.ts";
import * as libraryCache from "../Util/Services/libCaching.ts";
import * as tokenManager from "../Util/Services/adminTokenManager.ts";
import { URL } from "url";
import type { DiscordAPIError } from "discord.js";
import type { botReasons } from "../../@types/enums.ts";
import { Response as fetchRes } from "node-fetch";
import { DAPI } from "../Util/Services/discord.ts";

import mdi from "markdown-it";
import entities from "html-entities";
import { Vibrant } from "node-vibrant/node";
const md = new mdi();
const router = express.Router();

function botType(bodyType: string): number {
    let type: botReasons = parseInt(bodyType);

    if (type > 15) type = 0;

    return type;
}

router.get("/search", (_req: Request, res: Response) => {
    res.redirect("/search");
});

router.get("/:id/accent_color", variables, permission.auth, checks.botExists, async (req: Request, res: Response) => {
    let bot = req.attached.bot;
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
    let bot_avatar = await fetch(bot.avatar?.url ? bot.avatar!.url : bot.icon!.url);
    if (!bot_avatar.ok) return res.status(403).json({
        error: true,
        status: 403,
        errors: ["Unable to fetch avatar!"] // TODO: Translate
    });
    let palette = (await Vibrant.from(await bot_avatar.buffer()).getPalette()).Vibrant;
    return res.status(200).json({ color: palette.hex });
})

router.get(
    "/submit",
    variables,
    permission.auth,
    permission.scopes([OAuth2Scopes.GuildsJoin]),
    async (req: Request, res: Response) => {
        // in this specific instance it makes more sense to make a mongo query than filtering through the entire redis cache
        const showResubmitNote = await global.db
            .collection<delBot>("bots")
            .countDocuments(
                { "owner.id": req.user.id, "status.archived": true },
                { limit: 1 }
            );
        // this will return 1/true if something exists/is found, 0 if not.

        res.locals.premidPageInfo = res.__("premid.bots.submit");

        res.render("templates/bots/submit", {
            title: res.__("common.nav.me.submitBot"),
            subtitle: res.__("common.nav.me.submitBot.subtitle"),
            showResubmitNote,
            libraries: libraryCache.getLibs(),
            languages: libraryCache.getLanguages(),
            req,
            joinServerNotice: res.__("common.form.joinServer.full", {
                a: '<a href="https://discord.gg/WeCer3J" rel="noopener" target="_blank">',
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

        if (!req.body.bot && !req.body.slashCommands) {
            error = true;
            errors.push(res.__("common.error.bot.arr.noScopes"));
        }

        if (!req.body.id) {
            error = true;
            errors.push(res.__("common.error.listing.arr.IDRequired"));
        }

        if (Number.isNaN(req.body.id) || req.body.id.includes(" ")) {
            error = true;
            errors.push(res.__("common.error.bot.arr.invalidID"));
        }

        if (req.body.id.length > 32) {
            error = true;
            errors.push(res.__("common.error.bot.arr.idTooLong"));
        }

        if (req.body.clientID) {
            if (
                Number.isNaN(req.body.clientID) ||
                req.body.clientID.includes(" ")
            ) {
                error = true;
                errors.push(res.__("common.error.bot.arr.invalidClientID"));
            }

            if (req.body.clientID && req.body.clientID.length > 32) {
                error = true;
                errors.push(res.__("common.error.bot.arr.clientIDTooLong"));
            }

            await discord.bot.rest
                .get(Routes.user(req.body.clientID))
                .then(() => {
                    error = true;
                    errors.push(res.__("common.error.bot.arr.clientIDIsUser"));
                })
                .catch(() => {});
        }

        if (req.body.invite === "") {
            invite = `https://discord.com/api/oauth2/authorize?client_id=${req.body.clientID || req.body.id}&scope=${functions.parseScopes(req.body)}`;
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

        if (
            req.body.invite &&
            functions.isURL(req.body.invite) &&
            Number(new URL(req.body.invite).searchParams.get("permissions")) & 8
        ) {
            error = true;
            errors.push(res.__("common.error.listing.arr.inviteHasAdmin"));
        }

        if (req.body.banner && !functions.isURL(req.body.banner)) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invalidURL.banner"));
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
                Number.isNaN(req.body.widgetServer) ||
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
                await discord.bot.rest
                    .get(Routes.guildChannels(req.body.widgetServer))
                    .catch((e: DiscordAPIError) => {
                        if ([400, 404].includes(Number(e.code))) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.serverID.nonexistent"
                                )
                            );
                            fetchServer = false;
                        }
                    });

            if (fetchServer)
                await fetch("https://stonks.widgetbot.io/api/graphql", {
                    method: "post",
                    body: JSON.stringify({
                        query: `{guild(id:"${req.body.widgetServer}"){id}}`
                    }),
                    headers: { "Content-Type": "application/json" }
                })
                    .then(async (fetchRes: fetchRes) => {
                        const data: any = await fetchRes.json();
                        if (data && !data.guild?.id) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.guildNotFound"
                                )
                            );
                        }
                    })
                    .catch(() => {
                        error = true;
                        errors.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.guildNotFound"
                            )
                        );
                    });

            let fetchChannel = true;

            if (
                Number.isNaN(req.body.widgetChannel) ||
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
                await discord.bot.rest
                    .get(Routes.channel(req.body.widgetChannel))
                    .catch((e: DiscordAPIError) => {
                        if ([400, 404].includes(Number(e.code))) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.channelID.nonexistent"
                                )
                            );
                            fetchChannel = false;
                        }
                    });

            if (fetchChannel)
                await fetch("https://stonks.widgetbot.io/api/graphql", {
                    method: "post",
                    body: JSON.stringify({
                        query: `{channel(id:"${req.body.widgetChannel}"){id}}`
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

        if (req.body.twitter?.length > 15) {
            error = true;
            errors.push(res.__("common.error.bot.arr.twitterInvalid"));
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
        } else {
            if (
                req.body.longDescription.length < 150 &&
                !req.body.longDescription.includes("<iframe ")
            ) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.notAtMinChars", "150")
                );
            }

            if (req.body.longDescription.includes("http://")) {
                error = true;
                errors.push(res.__("common.error.listing.arr.containsHttp"));
            }
        }

        if (!req.body.prefix && !req.body.slashCommands) {
            error = true;
            errors.push(res.__("common.error.listing.arr.prefixRequired"));
        } else if (req.body.prefix?.length > 32) {
            error = true;
            errors.push(res.__("common.error.bot.arr.prefixTooLong"));
        } else if (req.body.prefix === "/" && !req.body.slashCommands) {
            error = true;
            errors.push(res.__("common.error.bot.arr.legacySlashPrefix"));
        }

        if (req.body.privacyPolicy) {
            if (
                req.body.privacyPolicy.length > 32 &&
                !functions.isURL(req.body.privacyPolicy)
            ) {
                error = true;
                errors.push(res.__("common.error.bot.arr.privacyTooLong"));
            }
            if (
                ["discord.bot", "my-cool-app.com"].some((s) =>
                    req.body.privacyPolicy.includes(s)
                )
            ) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.privacyPolicy.placeholder")
                );
            }
            if (req.body.privacyPolicy.includes("discord.com/privacy")) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.privacyPolicy.discord")
                );
            }
            if (/(yardım|yardim)/.test(req.body.privacyPolicy)) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.privacyPolicy.yardim")
                );
            }
            if (
                req.body.privacyPolicy.includes("help") &&
                !functions.isURL(req.body.privacyPolicy)
            ) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.privacyPolicy.help")
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

        // TODO: Refractor
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
            editors = [...new Set(req.body.editors.split(/\D+/g))].filter(
                (editor) => editor !== ""
            );
        } else {
            editors = [];
        }

        if (editors.includes(req.user.id)) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.removeYourselfEditor")
            );
        }

        let commands: APIApplicationCommand[] = [];

        if (req.body.slashCommands && req.user.db.auth) {
            if (Date.now() > req.user.db.auth.expires) {
                await refresh.requestNewAccessToken(
                    "discord",
                    req.user.db.auth.refreshToken,
                    async (
                        err,
                        accessToken,
                        refreshToken,
                        result: RESTPostOAuth2AccessTokenResult
                    ) => {
                        if (err) {
                            error = true;
                            if (functions.isDiscordAPIError(err)) {
                                errors.push(`${err.statusCode} ${err.data}`);
                            } else {
                                errors.push(err.message);
                            }
                        } else {
                            await global.db.collection("users").updateOne(
                                { _id: req.user.id },
                                {
                                    $set: {
                                        auth: {
                                            accessToken,
                                            refreshToken,
                                            expires:
                                                Date.now() +
                                                result.expires_in * 1000
                                        }
                                    }
                                }
                            );
                            await userCache.updateUser(req.user.id);
                        }
                    }
                );
            }
            const receivedCommands = (await (
                await fetch(DAPI + Routes.applicationCommands(req.body.id), {
                    headers: {
                        authorization: `Bearer ${req.user.db.auth.accessToken}`
                    }
                })
            )
                .json()
                .catch(() => {})) as APIApplicationCommand[];
            if (Array.isArray(receivedCommands)) commands = receivedCommands;
        }

        let userFlags = 0;

        if (req.body.bot) {
            const user = (await discord.bot.rest
                .get(Routes.user(req.body.id))
                .catch(() => {})) as APIUser;
            if (user.public_flags) userFlags = user.public_flags;
        }

        if (error === true)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });

        discord.bot.rest
            .get(`/applications/${req.body.clientID || req.body.id}/rpc`)
            .then(async (app: APIApplication) => {
                if (app.bot_public === false)
                    // not !app.bot_public; should not trigger when undefined
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notPublic")]
                    });

                if (req.body.bot && !("bot_public" in app))
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.noBot")]
                    });

                await global.db.collection<delBot>("bots").insertOne({
                    _id: req.body.id,
                    clientID: req.body.clientID,
                    name: app.name,
                    prefix: req.body.prefix,
                    library,
                    tags,
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
                    lastDenyReason: "",
                    reviewNotes: [],
                    editors,
                    commands,
                    userFlags,
                    owner: {
                        id: req.user.id
                    },
                    icon: {
                        hash: app.icon,
                        url: `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}`
                    },
                    votes: {
                        positive: [],
                        negative: []
                    },
                    scopes: {
                        bot: req.body.bot,
                        slashCommands: req.body.slashCommands
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
                        archived: false,
                        hidden: false,
                        modHidden: false
                    },
                    labels: {
                        ai: !!req.body.ai,
                        nsfw: !!req.body.nsfw
                    }
                } satisfies delBot);

                await discord.channels.logs.send(
                    `${settings.emoji.add} **${functions.escapeFormatting(
                        req.user.db.fullUsername
                    )}** \`(${
                        req.user.id
                    })\` added bot **${functions.escapeFormatting(
                        app.name
                    )}** \`(${req.body.id})\`\n<${settings.website.url}/bots/${
                        req.body.id
                    }>`
                );

                await global.db.collection("audit").insertOne({
                    type: "SUBMIT_BOT",
                    executor: req.user.id,
                    target: req.body.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: {
                            _id: req.body.id,
                            name: app.name,
                            prefix: req.body.prefix,
                            library,
                            tags,
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
                            lastDenyReason: "",
                            reviewNotes: [],
                            editors,
                            commands,
                            owner: {
                                id: req.user.id
                            },
                            icon: {
                                hash: app.icon,
                                url: `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}`
                            },
                            votes: {
                                positive: [],
                                negative: []
                            },
                            scopes: {
                                bot: req.body.bot,
                                slashCommands: req.body.slashCommands
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
                                archived: false,
                                hidden: false,
                                modHidden: false
                            },
                            labels: {
                                ai: !!req.body.ai,
                                nsfw: !!req.body.nsfw
                            }
                        } satisfies delBot
                    }
                });
                await botCache.updateBot(req.body.id);

                await discord.postWebMetric("bot");

                return res.status(200).json({
                    error: false,
                    status: 200,
                    errors: []
                });
            })
            .catch((error: DiscordAPIError) => {
                if (error.code === RESTJSONErrorCodes.UnknownApplication)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notFound")]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [
                        res.__("common.error.bot.arr.fetchError"),
                        `${error.name}: ${error.message}`,
                        `${error.code} ${error.method} ${error.url}`
                    ]
                });
            });
    }
);

router.get(
    "/:id/tokenreset",
    variables,
    permission.auth,
    checks.botExists,
    async (req: Request, res: Response) => {
        const bot = req.attached.bot;

        if (
            bot.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                res,
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
            res,
            title: res.__("common.success"),
            subtitle: res.__("common.success.bot.tokenReset"),
            status: 200,
            type: "Success",
            req
        });
    }
);

router.post(
    "/:id/transfer-owner",
    variables,
    permission.assistant,
    checks.botExists,
    async (req: Request, res: Response) => {
        const bot = req.attached.bot;

        if (req.user.db.rank.assistant === false) {
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                subtitle: res.__("common.error.notAssistant"),
                status: 403,
                type: "Error",
                req
            });
        }

        const newOwnerExists = await global.db
            .collection("users")
            .findOne({ _id: req.body.newOwner });

        if (!newOwnerExists)
            return res.status(422).render("status", {
                res,
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.transferOwnership.422"),
                status: 422,
                type: "Error",
                req
            });

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    owner: {
                        id: req.body.newOwner
                    }
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "MODIFY_OWNER",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: bot.owner.id,
                new: req.body.newOwner
            }
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${req.params.id}`);
    }
);

router.post(
    "/:id/setvanity",
    variables,
    permission.auth,
    checks.botExists,
    async (req: Request, res: Response) => {
        const bot = req.attached.bot;

        if (
            bot.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.perms.vanity"),
                status: 403,
                type: "Error",
                req
            });

        if (
            req.body.vanity.includes(".") ||
            req.body.vanity.includes("/") ||
            req.body.vanity.includes("\\") ||
            (settings.website.bannedVanityURLs &&
                settings.website.bannedVanityURLs.includes(
                    req.body.vanity.toLowerCase()
                ))
        )
            return res.status(400).render("status", {
                res,
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
                    res,
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.conflict"),
                    status: 409,
                    type: "Error",
                    req
                });
        }

        if (bot.vanityUrl) {
            if (req.body.vanity.split(" ").length !== 1)
                return res.status(400).render("status", {
                    res,
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.tooLong"),
                    status: 400,
                    type: "Error",
                    req
                });

            if (req.body.vanity === bot.vanityUrl)
                return res.status(400).render("status", {
                    res,
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.same"),
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
                    old: bot.vanityUrl,
                    new: req.body.vanity
                }
            });
            await botCache.updateBot(req.params.id);

            res.redirect(`/bots/${req.params.id}`);
        } else if (!bot.vanityUrl) {
            if (req.body.vanity.split(" ").length !== 1)
                return res.status(400).render("status", {
                    res,
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.tooLong"),
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
    checks.botExists,
    async (req: Request, res: Response) => {
        const bot = req.attached.bot;

        res.locals.premidPageInfo = res.__("premid.bots.edit", bot.name);

        if (
            bot.owner.id !== req.user.id &&
            !bot.editors.includes(req.user.id) &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.perms.edit"),
                status: 403,
                type: "Error",
                req
            });

        const clean = sanitizeHtml(bot.longDesc, {
            allowedTags: htmlRef.standard.tags,
            allowedAttributes: htmlRef.standard.attributes,
            allowVulnerableTags: true,
            disallowedTagsMode: "escape",
            transformTags: {
                iframe: function (_tagName, attribs) {
                    attribs.sandbox = "allow-forms";
                    return {
                        tagName: "iframe",
                        attribs: attribs
                    };
                }
            }
        });

        res.render("templates/bots/edit", {
            title: res.__("page.bots.edit.title"),
            subtitle: res.__("page.bots.edit.subtitle", bot.name),
            libraries: libraryCache.getLibs(),
            languages: libraryCache.getLanguages(),
            settings,
            bot: bot,
            editors: bot.editors ? bot.editors.join(" ") : "",
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
    async (req: Request, res: Response) => {
        let error = false;
        let errors: string[] = [];

        const bot: delBot | undefined = await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).json({
                error: true,
                status: 404,
                errors: [res.__("common.error.bot.404")]
            });

        if (!req.body.bot && !req.body.slashCommands) {
            error = true;
            errors.push(res.__("common.error.bot.arr.noScopes"));
        }

        if (req.body.clientID) {
            if (
                Number.isNaN(req.body.clientID) ||
                req.body.clientID.includes(" ")
            ) {
                error = true;
                errors.push(res.__("common.error.bot.arr.invalidClientID"));
            }
            if (req.body.clientID && req.body.clientID.length > 32) {
                error = true;
                errors.push(res.__("common.error.bot.arr.clientIDTooLong"));
            }
            if (req.body.clientID !== req.params.id)
                await discord.bot.rest
                    .get(Routes.user(req.body.clientID))
                    .then(() => {
                        error = true;
                        errors.push(
                            res.__("common.error.bot.arr.clientIDIsUser")
                        );
                    })
                    .catch(() => {});
        }

        res.locals.premidPageInfo = res.__("premid.bots.edit", bot.name);

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
            invite = `https://discord.com/api/oauth2/authorize?client_id=${req.body.clientID || req.params.id}&scope=${functions.parseScopes(req.body)}`;
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
            } else if (
                req.body.invite.includes("discord.com") &&
                ((req.body.bot &&
                    !req.body.invite.includes(OAuth2Scopes.Bot)) ||
                    (req.body.slashCommands &&
                        !req.body.invite.includes(
                            OAuth2Scopes.ApplicationsCommands
                        )))
            ) {
                error = true;
                errors.push(res.__("common.error.bot.arr.scopesNotInInvite"));
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
                Number.isNaN(req.body.widgetServer) ||
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
                await discord.bot.rest
                    .get(Routes.guildChannels(req.body.widgetChannel))
                    .catch((e: DiscordAPIError) => {
                        if ([400, 404].includes(Number(e.code))) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.serverID.nonexistent"
                                )
                            );
                            fetchServer = false;
                        }
                    });

            if (fetchServer)
                await fetch("https://stonks.widgetbot.io/api/graphql", {
                    method: "post",
                    body: JSON.stringify({
                        query: `{guild(id:"${req.body.widgetServer}"){id}}`
                    }),
                    headers: { "Content-Type": "application/json" }
                })
                    .then(async (fetchRes: fetchRes) => {
                        const data: any = await fetchRes.json();
                        if (data && !data.guild?.id) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.guildNotFound"
                                )
                            );
                        }
                    })
                    .catch(() => {
                        error = true;
                        errors.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.guildNotFound"
                            )
                        );
                    });

            let fetchChannel = true;

            if (
                Number.isNaN(req.body.widgetChannel) ||
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
                await discord.bot.rest
                    .get(Routes.channel(req.body.widgetChannel))
                    .catch((e: DiscordAPIError) => {
                        if ([400, 404].includes(Number(e.code))) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.channelID.nonexistent"
                                )
                            );
                            fetchChannel = false;
                        }
                    });

            if (fetchChannel)
                await fetch("https://stonks.widgetbot.io/api/graphql", {
                    method: "post",
                    body: JSON.stringify({
                        query: `{channel(id:"${req.body.widgetChannel}"){id}}`
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

        if (req.body.twitter?.length > 15) {
            error = true;
            errors.push(res.__("common.error.bot.arr.twitterInvalid"));
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
        } else {
            if (
                req.body.longDescription.length < 150 &&
                !req.body.longDescription.includes("<iframe ")
            ) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.notAtMinChars", "150")
                );
            }

            if (req.body.longDescription.includes("http://")) {
                error = true;
                errors.push(res.__("common.error.listing.arr.containsHttp"));
            }
        }

        if (!req.body.prefix && !req.body.slashCommands) {
            error = true;
            errors.push(res.__("common.error.listing.arr.prefixRequired"));
        } else if (req.body.prefix?.length > 32) {
            error = true;
            errors.push(res.__("common.error.bot.arr.prefixTooLong"));
        } else if (req.body.prefix === "/" && !req.body.slashCommands) {
            error = true;
            errors.push(res.__("common.error.bot.arr.legacySlashPrefix"));
        }

        if (req.body.privacyPolicy) {
            if (
                req.body.privacyPolicy.length > 32 &&
                !functions.isURL(req.body.privacyPolicy)
            ) {
                error = true;
                errors.push(res.__("common.error.bot.arr.privacyTooLong"));
            }
            if (req.body.privacyPolicy.includes("discord.bot/privacy")) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.privacyPolicy.placeholder")
                );
            }

            if (req.body.privacyPolicy.includes("discord.com/privacy")) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.privacyPolicy.discord")
                );
            }

            if (/(yardım|yardim)/.test(req.body.privacyPolicy)) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.privacyPolicy.yardim")
                );
            }

            if (
                req.body.privacyPolicy.includes("help") &&
                !functions.isURL(req.body.privacyPolicy)
            ) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.privacyPolicy.help")
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
            editors = [...new Set(req.body.editors.split(/\D+/g))].filter(
                (editor) => editor !== ""
            );
        } else {
            editors = [];
        }

        if (editors.includes(req.user.id) && bot.owner.id === req.user.id) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.removeYourselfEditor")
            );
        }

        let commands: APIApplicationCommand[] = bot.commands || [];

        if (req.body.slashCommands && req.user.db.auth) {
            if (Date.now() > req.user.db.auth.expires) {
                await refresh.requestNewAccessToken(
                    "discord",
                    req.user.db.auth.refreshToken,
                    async (
                        err,
                        accessToken,
                        refreshToken,
                        result: RESTPostOAuth2AccessTokenResult
                    ) => {
                        if (err) {
                            error = true;

                            if (functions.isDiscordAPIError(err)) {
                                errors.push(`${err.statusCode} ${err.data}`);
                            } else {
                                errors.push(err.message);
                            }
                        } else {
                            await global.db.collection("users").updateOne(
                                { _id: req.user.id },
                                {
                                    $set: {
                                        auth: {
                                            accessToken,
                                            refreshToken,
                                            expires:
                                                Date.now() +
                                                result.expires_in * 1000
                                        }
                                    }
                                }
                            );
                            await userCache.updateUser(req.user.id);
                        }
                    }
                );
            }

            const receivedCommands = (await (
                await fetch(DAPI + Routes.applicationCommands(bot._id), {
                    headers: {
                        authorization: `Bearer ${req.user.db.auth.accessToken}`
                    }
                })
            )
                .json()
                .catch(() => {})) as APIApplicationCommand[];
            if (Array.isArray(receivedCommands)) commands = receivedCommands;
        }

        let userFlags = 0;

        if (req.body.bot) {
            const user = (await discord.bot.rest
                .get(Routes.user(bot._id))
                .catch(() => {})) as APIUser;
            if (user.public_flags) userFlags = user.public_flags;
        }

        if (error === true) {
            req.body.status
                ? (req.body.status.premium = bot.status.premium)
                : (req.body.status = { premium: bot.status.premium });

            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });
        }

        discord.bot.rest
            .get(`/applications/${req.body.clientID || req.body.id}/rpc`)
            .then(async (app: APIApplication) => {
                if (app.bot_public === false)
                    // not !app.bot_public; should not trigger when undefined
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notPublic")]
                    });

                await global.db.collection("bots").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            clientID: req.body.clientID,
                            name: app.name,
                            prefix: req.body.prefix,
                            library,
                            tags,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            editors,
                            commands,
                            userFlags,
                            icon: {
                                hash: app.icon,
                                url: `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}`
                            },
                            scopes: {
                                bot: req.body.bot,
                                slashCommands: req.body.slashCommands
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
                                useCustomColour: req.body.useAutoAccent ? true : req.body.useCustomColour,
                                colour: req.body.colour,
                                banner: req.body.banner
                            },
                            widgetbot: {
                                channel: req.body.widgetChannel,
                                options: req.body.widgetOptions,
                                server: req.body.widgetServer
                            },
                            labels: {
                                ai: !!req.body.ai,
                                nsfw: !!req.body.nsfw
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
                            clientID: bot.clientID,
                            name: bot.name,
                            prefix: bot.prefix,
                            library: bot.library,
                            tags: bot.tags,
                            shortDesc: bot.shortDesc,
                            longDesc: bot.longDesc,
                            editors: bot.editors,
                            commands: bot.commands,
                            icon: {
                                hash: bot.icon.hash,
                                url: bot.icon.url
                            },
                            scopes: {
                                bot: req.body.bot,
                                slashCommands: req.body.slashCommands
                            },
                            links: {
                                invite: bot.links.invite,
                                support: bot.links.support,
                                website: bot.links.website,
                                donation: bot.links.donation,
                                repo: bot.links.repo,
                                privacyPolicy: bot.links.privacyPolicy
                            },
                            social: {
                                twitter: bot.social?.twitter
                            },
                            theme: {
                                useCustomColour: bot.theme?.useCustomColour,
                                colour: bot.theme?.colour,
                                banner: bot.theme?.banner
                            },
                            widgetbot: {
                                channel: bot.widgetbot.channel,
                                options: bot.widgetbot.options,
                                server: bot.widgetbot.server
                            },
                            labels: {
                                ai: bot.labels?.ai,
                                nsfw: bot.labels?.nsfw
                            }
                        } satisfies Partial<delBot>,
                        new: {
                            clientID: req.body.clientID,
                            name: app.name,
                            prefix: req.body.prefix,
                            library,
                            tags,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            editors,
                            commands,
                            icon: {
                                hash: app.icon,
                                url: `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}`
                            },
                            scopes: {
                                bot: req.body.bot,
                                slashCommands: req.body.slashCommands
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
                            labels: {
                                ai: !!req.body.ai,
                                nsfw: !!req.body.nsfw
                            }
                        } satisfies Partial<delBot>
                    }
                });
                await botCache.updateBot(req.params.id);

                discord.channels.logs
                    .send(
                        `${settings.emoji.edit} **${functions.escapeFormatting(
                            req.user.db.fullUsername
                        )}** \`(${
                            req.user.id
                        })\` edited bot **${functions.escapeFormatting(
                            app.name
                        )}** \`(${app.id})\`\n<${settings.website.url}/bots/${
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
                if (error.code === RESTJSONErrorCodes.UnknownApplication)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notFound")]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [
                        res.__("common.error.bot.arr.fetchError"),
                        `${error.name}: ${error.message}`,
                        `${error.code} ${error.method} ${error.url}`
                    ]
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
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });
        if (!bot) {
            bot = await global.db
                .collection<delBot>("bots")
                .findOne({ vanityUrl: req.params.id });
            if (!bot)
                return res.status(404).render("status", {
                    res,
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
            res,
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
            .collection<delUser>("users")
            .findOne({ _id: bot.owner.id });
    }

    let botStatus = await discord.getStatus(bot._id);

    const dirty = entities.decode(md.render(bot.longDesc));

    const clean = sanitizeHtml(dirty, {
        allowedTags: htmlRef.standard.tags,
        allowedAttributes: htmlRef.standard.attributes,
        allowVulnerableTags: true,
        transformTags: {
            iframe: function (_tagName, attribs) {
                attribs.sandbox = "allow-forms";
                return {
                    tagName: "iframe",
                    attribs: attribs
                };
            }
        }
    });

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
        title: `${bot.name} | ${res.__("common.bots.discord")}`,
        subtitle: bot.shortDesc,
        bot: bot,
        showStatus:
            botStatus !== PresenceUpdateStatus.Offline ||
            ((!bot.scopes || bot.scopes.bot) &&
                (!("userFlags" in bot) ||
                    !(bot.userFlags && UserFlags.BotHTTPInteractions))),
        longDesc: clean,
        botOwner: botOwner,
        botStatus: botStatus,
        mainServer: settings.guild.main,
        staffServer: settings.guild.staff,
        botServer: settings.guild.bot,
        webUrl: settings.website.url,
        req: req,
        editors,
        votes: bot.votes.positive.length - bot.votes.negative.length,
        functions,
        privacyIsURL: functions.isURL(bot.links.privacyPolicy),
        scopes: functions.parseScopes(bot.scopes)
    });
});

router.get("/:id/exists", permission.auth, async (req, res) => {
    res.type("text").send(
        String(await global.redis?.hexists("bots", req.params.id))
    );
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

router.post(
    "/:id/report",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        const bot = await botCache.getBot(req.params.id);

        if (!bot)
            return res.status(404).json({
                error: true,
                status: 404,
                message: res.__("common.error.bot.404")
            });

        if (bot.owner.id === req.user.id)
            return res.status(403).json({
                error: true,
                status: 403,
                message: res.__("common.error.report.self")
            });

        try {
            const embed = new Discord.EmbedBuilder();
            embed.setColor(0x2f3136);
            embed.setTitle("Bot Report");
            embed.setURL(`${settings.website.url}/bots/${bot._id}`);
            embed.addFields(
                {
                    name: "Reason",
                    value: req.body.reason ? req.body.reason : "None provided."
                },
                {
                    name: "Additional information",
                    value: req.body.additionalInfo
                        ? req.body.additionalInfo
                        : "None provided."
                }
            );

            await discord.channels.alerts.send({
                content: `${settings.emoji.report} **${functions.escapeFormatting(
                    req.user.db.fullUsername
                )}** \`(${
                    req.user.id
                })\` reported bot **${functions.escapeFormatting(
                    bot.name
                )}** \`(${bot._id})\``,
                embeds: [embed]
            });

            return res.status(200).json({
                error: false,
                status: 200,
                message: res.__("common.report.done")
            });
        } catch (e) {
            return res.status(500).json({
                error: true,
                status: 500,
                message: res.__("common.error.report")
            });
        }
    }
);

router.get(
    "/:id/upvote",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        let bot = await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot) {
            bot = await global.db
                .collection<delBot>("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    res,
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
            await global.db.collection("audit").insertOne({
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
            await global.db.collection("audit").insertOne({
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

        await botCache.updateBot(<string>bot._id);

        res.redirect(`/bots/${bot._id}`);
    }
);

router.get(
    "/:id/downvote",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        let bot = await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot) {
            bot = await global.db
                .collection<delBot>("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    res,
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
            await global.db.collection("audit").insertOne({
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
            await global.db.collection("audit").insertOne({
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
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot) {
            bot = await global.db
                .collection<delBot>("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    res,
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
                    type: "Error",
                    req: req
                });
        }

        if (!req.user || req.user.id !== bot.owner.id)
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__("common.error.bot.perms.notOwner"),
                type: "Error",
                user: req.user,
                req: req
            });

        await discord.channels.logs.send(
            `${settings.emoji.delete} **${functions.escapeFormatting(
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
    "/:id/archive",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        let bot = (await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id })) as delBot;

        if (!bot) {
            bot = await global.db
                .collection<delBot>("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    res,
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
                    type: "Error",
                    req: req
                });
        }

        if (!req.user || req.user.id !== bot.owner.id)
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__("common.error.bot.perms.notOwner"),
                type: "Error",
                user: req.user,
                req: req
            });

        await discord.channels.logs.send(
            `${settings.emoji.archive} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` archived bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\``
        );

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.archived": true,
                    "status.approved": false
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "ARCHIVE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        res.redirect("/users/@me");
    }
);

router.get(
    "/:id/hide",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        let bot = (await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id })) as delBot;

        if (!bot) {
            bot = await global.db
                .collection<delBot>("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    res,
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
                    type: "Error",
                    req: req
                });
        }

        if (!req.user || req.user.id !== bot.owner.id)
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__("common.error.bot.perms.notOwner"),
                type: "Error",
                user: req.user,
                req: req
            });

        if (bot.status.approved === false)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueueHide"),
                req,
                type: "Error"
            });

        await discord.channels.logs.send(
            `${settings.emoji.hide} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` hid bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\``
        );

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.hidden": true
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "HIDE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${bot._id}`);
    }
);

router.get(
    "/:id/unhide",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        let bot = (await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id })) as delBot;

        if (!bot) {
            bot = await global.db
                .collection<delBot>("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    res,
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
                    type: "Error",
                    req: req
                });
        }

        if (!req.user || req.user.id !== bot.owner.id)
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__("common.error.bot.perms.notOwner"),
                type: "Error",
                user: req.user,
                req: req
            });

        await discord.channels.logs.send(
            `${settings.emoji.unhide} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` unhid bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\``
        );

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.hidden": false
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "UNHIDE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${bot._id}`);
    }
);

router.get(
    "/:id/resubmit",
    variables,
    permission.auth,
    permission.scopes([OAuth2Scopes.GuildsJoin]),
    checks.botExists,
    async (req: Request, res: Response) => {
        const bot = req.attached.bot;

        if (bot.status.archived === false)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.notArchived"),
                status: 400,
                type: "Error",
                req
            });

        if (
            bot.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.perms.resubmit"),
                status: 403,
                type: "Error",
                req
            });

        res.locals.premidPageInfo = res.__("premid.bots.resubmit", bot.name);

        res.render("templates/bots/edit", {
            title: res.__("page.bots.resubmit.title"),
            subtitle: res.__("page.bots.resubmit.subtitle", bot.name),
            libraries: libraryCache.getLibs(),
            languages: libraryCache.getLanguages(),
            settings,
            bot: bot,
            editors: bot.editors ? bot.editors.join(" ") : "",
            req,
            resubmit: true,
            longDesc: bot.longDesc
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
        let errors: string[] = [];

        const bot: delBot | undefined = await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).json({
                error: true,
                status: 404,
                errors: [res.__("common.error.bot.404")]
            });

        if (!req.body.bot && !req.body.slashCommands) {
            error = true;
            errors.push(res.__("common.error.bot.arr.noScopes"));
        }

        if (req.body.clientID) {
            if (
                Number.isNaN(req.body.clientID) ||
                req.body.clientID.includes(" ")
            ) {
                error = true;
                errors.push(res.__("common.error.bot.arr.invalidClientID"));
            }

            if (req.body.clientID && req.body.clientID.length > 32) {
                error = true;
                errors.push(res.__("common.error.bot.arr.clientIDTooLong"));
            }

            if (req.body.clientID !== req.params.id)
                await discord.bot.rest
                    .get(Routes.user(req.body.clientID))
                    .then(() => {
                        error = true;
                        errors.push(
                            res.__("common.error.bot.arr.clientIDIsUser")
                        );
                    })
                    .catch(() => {});
        }

        if (bot.status.archived === false)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: [res.__("common.error.bot.notArchived")]
            });

        if (
            bot.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).json({
                error: true,
                status: 403,
                errors: [res.__("common.error.bot.perms.resubmit")]
            });

        res.locals.premidPageInfo = res.__("premid.bots.resubmit", bot.name);

        let invite: string;

        if (req.body.invite === "") {
            invite = `https://discord.com/api/oauth2/authorize?client_id=${req.body.clientID || req.params.id}&scope=${functions.parseScopes(req.body)}`;
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
                Number.isNaN(req.body.widgetServer) ||
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
                await discord.bot.rest
                    .get(Routes.guildChannels(req.body.widgetServer))
                    .catch((e: DiscordAPIError) => {
                        if ([400, 404].includes(Number(e.code))) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.serverID.nonexistent"
                                )
                            );
                            fetchServer = false;
                        }
                    });

            if (fetchServer)
                await fetch("https://stonks.widgetbot.io/api/graphql", {
                    method: "post",
                    body: JSON.stringify({
                        query: `{guild(id:"${req.body.widgetServer}"){id}}`
                    }),
                    headers: { "Content-Type": "application/json" }
                })
                    .then(async (fetchRes: fetchRes) => {
                        const data: any = await fetchRes.json();
                        if (data && !data.guild?.id) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.guildNotFound"
                                )
                            );
                        }
                    })
                    .catch(() => {
                        error = true;
                        errors.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.guildNotFound"
                            )
                        );
                    });

            let fetchChannel = true;

            if (
                Number.isNaN(req.body.widgetChannel) ||
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
                await discord.bot.rest
                    .get(Routes.channel(req.body.widgetChannel))
                    .catch((e: DiscordAPIError) => {
                        if ([400, 404].includes(Number(e.code))) {
                            error = true;
                            errors.push(
                                res.__(
                                    "common.error.listing.arr.widgetbot.channelID.nonexistent"
                                )
                            );
                            fetchChannel = false;
                        }
                    });

            if (fetchChannel)
                await fetch("https://stonks.widgetbot.io/api/graphql", {
                    method: "post",
                    body: JSON.stringify({
                        query: `{channel(id:"${req.body.widgetChannel}"){id}}`
                    }),
                    headers: { "Content-Type": "application/json" }
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

        if (req.body.twitter?.length > 15) {
            error = true;
            errors.push(res.__("common.error.bot.arr.twitterInvalid"));
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
        } else {
            if (
                req.body.longDescription.length < 150 &&
                !req.body.longDescription.includes("<iframe ")
            ) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.notAtMinChars", "150")
                );
            }

            if (req.body.longDescription.includes("http://")) {
                error = true;
                errors.push(res.__("common.error.listing.arr.containsHttp"));
            }
        }

        if (!req.body.prefix && !req.body.slashCommands) {
            error = true;
            errors.push(res.__("common.error.listing.arr.prefixRequired"));
        } else if (req.body.prefix?.length > 32) {
            error = true;
            errors.push(res.__("common.error.bot.arr.prefixTooLong"));
        } else if (req.body.prefix === "/" && !req.body.slashCommands) {
            error = true;
            errors.push(res.__("common.error.bot.arr.legacySlashPrefix"));
        }

        if (req.body.privacyPolicy) {
            if (
                req.body.privacyPolicy.length > 32 &&
                !functions.isURL(req.body.privacyPolicy)
            ) {
                error = true;
                errors.push(res.__("common.error.bot.arr.privacyTooLong"));
            }
            if (req.body.privacyPolicy.includes("discord.bot/privacy")) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.privacyPolicy.placeholder")
                );
            }

            if (req.body.privacyPolicy.includes("discord.com/privacy")) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.privacyPolicy.discord")
                );
            }

            if (/(yardım|yardim)/.test(req.body.privacyPolicy)) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.privacyPolicy.yardim")
                );
            }

            if (
                req.body.privacyPolicy.includes("help") &&
                !functions.isURL(req.body.privacyPolicy)
            ) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.privacyPolicy.help")
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
            editors = [...new Set(req.body.editors.split(/\D+/g))].filter(
                (editor) => editor !== ""
            );
        } else {
            editors = [];
        }

        if (editors.includes(req.user.id) && bot.owner.id === req.user.id) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.removeYourselfEditor")
            );
        }

        let commands: APIApplicationCommand[] = bot.commands || [];

        if (req.body.slashCommands && req.user.db.auth) {
            if (Date.now() > req.user.db.auth.expires) {
                await refresh.requestNewAccessToken(
                    "discord",
                    req.user.db.auth.refreshToken,
                    async (
                        err,
                        accessToken,
                        refreshToken,
                        result: RESTPostOAuth2AccessTokenResult
                    ) => {
                        if (err) {
                            error = true;

                            if (functions.isDiscordAPIError(err)) {
                                errors.push(`${err.statusCode} ${err.data}`);
                            } else {
                                errors.push(err.message);
                            }
                        } else {
                            await global.db.collection("users").updateOne(
                                { _id: req.user.id },
                                {
                                    $set: {
                                        auth: {
                                            accessToken,
                                            refreshToken,
                                            expires:
                                                Date.now() +
                                                result.expires_in * 1000
                                        }
                                    }
                                }
                            );
                            await userCache.updateUser(req.user.id);
                        }
                    }
                );
            }

            const receivedCommands = (await (
                await fetch(DAPI + Routes.applicationCommands(bot._id), {
                    headers: {
                        authorization: `Bearer ${req.user.db.auth.accessToken}`
                    }
                })
            )
                .json()
                .catch(() => {})) as APIApplicationCommand[];
            if (Array.isArray(receivedCommands)) commands = receivedCommands;
        }

        let userFlags = 0;

        if (req.body.bot) {
            const user = (await discord.bot.rest
                .get(Routes.user(bot._id))
                .catch(() => {})) as APIUser;
            if (user.public_flags) userFlags = user.public_flags;
        }

        if (error === true)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });

        discord.bot.rest
            .get(`/applications/${req.body.clientID || req.body.id}/rpc`)
            .then(async (app: APIApplication) => {
                if (app.bot_public === false)
                    // not !app.bot_public; should not trigger when undefined
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notPublic")]
                    });

                await global.db.collection("bots").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            clientID: req.body.clientID,
                            name: app.name,
                            prefix: req.body.prefix,
                            library,
                            tags,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            editors,
                            commands,
                            userFlags,
                            icon: {
                                hash: app.icon,
                                url: `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}`
                            },
                            scopes: {
                                bot: req.body.bot,
                                slashCommands: req.body.slashCommands
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
                            labels: {
                                ai: !!req.body.ai,
                                nsfw: !!req.body.nsfw
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
                            clientID: bot.clientID,
                            name: bot.name,
                            prefix: bot.prefix,
                            library: bot.library,
                            tags: bot.tags,
                            shortDesc: bot.shortDesc,
                            longDesc: bot.longDesc,
                            editors: bot.editors,
                            commands: bot.commands,
                            icon: {
                                hash: bot.icon.hash,
                                url: bot.icon.url
                            },
                            scopes: {
                                bot: req.body.bot,
                                slashCommands: req.body.slashCommands
                            },
                            links: {
                                invite: bot.links.invite,
                                support: bot.links.support,
                                website: bot.links.website,
                                donation: bot.links.donation,
                                repo: bot.links.repo,
                                privacyPolicy: bot.links.privacyPolicy
                            },
                            social: {
                                twitter: bot.social?.twitter
                            },
                            theme: {
                                useCustomColour: bot.theme?.useCustomColour,
                                colour: bot.theme?.colour,
                                banner: bot.theme?.banner
                            },
                            widgetbot: {
                                channel: bot.widgetbot.channel,
                                options: bot.widgetbot.options,
                                server: bot.widgetbot.server
                            },
                            status: {
                                archived: true
                            },
                            labels: {
                                ai: bot.labels?.ai,
                                nsfw: bot.labels?.nsfw
                            }
                        } satisfies partialBot,
                        new: {
                            clientID: req.body.clientID,
                            name: app.name,
                            prefix: req.body.prefix,
                            library,
                            tags,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            editors,
                            commands,
                            icon: {
                                hash: app.icon,
                                url: `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}`
                            },
                            scopes: {
                                bot: req.body.bot,
                                slashCommands: req.body.slashCommands
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
                            },
                            labels: {
                                ai: !!req.body.ai,
                                nsfw: !!req.body.nsfw
                            }
                        } satisfies partialBot
                    }
                });

                await botCache.updateBot(req.params.id);

                await discord.channels.logs
                    .send(
                        `${settings.emoji.resubmit} **${functions.escapeFormatting(
                            req.user.db.fullUsername
                        )}** \`(${
                            req.user.id
                        })\` resubmitted bot **${functions.escapeFormatting(
                            app.name
                        )}** \`(${app.id})\`\n<${settings.website.url}/bots/${
                            app.id
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
                if (error.code === RESTJSONErrorCodes.UnknownApplication)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notFound")]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [
                        res.__("common.error.bot.arr.fetchError"),
                        `${error.name}: ${error.message}`,
                        `${error.code} ${error.method} ${error.url}`
                    ]
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
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === true)
            return res.status(400).render("status", {
                res,
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
                $inc: {
                    "staffTracking.handledBots.allTime.total": 1,
                    "staffTracking.handledBots.allTime.approved": 1,
                    "staffTracking.handledBots.thisWeek.total": 1,
                    "staffTracking.handledBots.thisWeek.approved": 1
                }
            }
        );

        await userCache.updateUser(req.user.id);

        await discord.channels.logs
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

        const owner = await discord.getMember(bot.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.check
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been approved on the website!${
                        !bot.scopes || bot.scopes.bot
                            ? "\n\nYour bot will be added to our server within the next 24 hours."
                            : ""
                    }`
                )
                .catch((e) => {
                    console.error(e);
                });

        const mainGuildOwner = await discord.getMember(bot.owner.id);
        if (mainGuildOwner)
            mainGuildOwner.roles
                .add(settings.roles.developer, "User's bot was just approved.")
                .catch(async (e) => {
                    console.error(e);
                    await discord.channels.alerts.send(
                        `${settings.emoji.error} Failed giving <@${bot.owner.id}> \`${bot.owner.id}\` the role **Bot Developer** upon one of their bots being approved.`
                    );
                });

        const mainGuildBot = await discord.getMember(bot._id);
        if (mainGuildBot)
            mainGuildBot.roles
                .add(settings.roles.bot, "Bot was approved on the website.")
                .catch(async (e) => {
                    console.error(e);
                    await discord.channels.alerts.send(
                        `${settings.emoji.error} Failed giving <@${bot._id}> \`${bot._id}\` the role **Bot** upon being approved on the website.`
                    );
                });

        const botStaffServer = await discord.getTestingGuildMember(bot._id);
        if (botStaffServer)
            botStaffServer
                .kick("Bot was approved on the website.")
                .catch(async (e) => {
                    console.error(e);
                    await discord.channels.alerts.send(
                        `${settings.emoji.error} Failed kicking <@${bot._id}> \`${bot._id}\` from the Testing Server on approval.`
                    );
                });

        await global.db.collection("audit").insertOne({
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
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.premium === true)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.alreadyPremium"),
                req,
                type: "Error"
            });

        const botMember = await discord.getMember(bot._id);

        if (botMember)
            botMember.roles
                .add(
                    settings.roles.premiumBot,
                    "Bot was given premium on the website."
                )
                .catch(async (e) => {
                    console.error(e);
                    await discord.channels.alerts.send(
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

        await global.db.collection("audit").insertOne({
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
        const bot = await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.premium === false)
            return res.status(400).render("status", {
                res,
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

        await global.db.collection("audit").insertOne({
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
        const bot: delBot = await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__("premid.bots.decline", bot.name);

        if (bot.status.approved === true)
            return res.status(400).render("status", {
                res,
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
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === true)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.notInQueue"),
                req,
                type: "Error"
            });

        if (!req.body.reason && !req.user.db.rank.admin) {
            return res.status(400).render("status", {
                res,
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
                    lastDenyReason: req.body.reason,
                    "status.archived": true
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $inc: {
                    "staffTracking.handledBots.allTime.total": 1,
                    "staffTracking.handledBots.allTime.declined": 1,
                    "staffTracking.handledBots.thisWeek.total": 1,
                    "staffTracking.handledBots.thisWeek.declined": 1
                }
            }
        );

        await userCache.updateUser(req.user.id);

        const type = botType(req.body.type);

        await global.db.collection("audit").insertOne({
            type: "DECLINE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            reasonType: type
        });

        await botCache.updateBot(req.params.id);

        const embed = new Discord.EmbedBuilder();
        embed.setColor(0x2f3136);
        embed.setTitle("Reason");
        embed.setDescription(req.body.reason);
        embed.setURL(`${settings.website.url}/bots/${bot._id}`);

        await discord.channels.logs.send({
            content: `${settings.emoji.cross} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` declined bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\``,
            embeds: [embed]
        });

        const member = await discord.getTestingGuildMember(req.params.id);

        if (member) {
            await member.kick("Bot's listing has been declined.").catch((e) => {
                console.error(e);
            });
        }

        const owner = await discord.getMember(bot.owner.id);
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
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (!bot.status.approved)
            return res.status(400).render("status", {
                res,
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
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (!bot.status.approved)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueue"),
                req,
                type: "Error"
            });

        if (!req.body.reason && !req.user.db.rank.admin) {
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.reasonRequired"),
                req,
                type: "Error"
            });
        }

        const type = botType(req.body.type);

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
                $inc: {
                    "staffTracking.handledBots.allTime.total": 1,
                    "staffTracking.handledBots.allTime.unapprove": 1,
                    "staffTracking.handledBots.thisWeek.total": 1,
                    "staffTracking.handledBots.thisWeek.unapprove": 1
                }
            }
        );

        await userCache.updateUser(req.user.id);

        await global.db.collection("audit").insertOne({
            type: "UNAPPROVE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            reasonType: type
        });

        await botCache.updateBot(req.params.id);

        const embed = new Discord.EmbedBuilder();
        embed.setColor(0x2f3136);
        embed.setTitle("Reason");
        embed.setDescription(req.body.reason);
        embed.setURL(`${settings.website.url}/bots/${bot._id}`);

        await discord.channels.logs.send({
            content: `${settings.emoji.unapprove} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` unapproved bot **${functions.escapeFormatting(
                bot.name
            )}** \`(${bot._id})\``,
            embeds: [embed]
        });

        const member = await discord.getMember(req.params.id);

        if (member && !settings.website.dev) {
            await member.kick("Bot has been unapproved.").catch((e) => {
                console.error(e);
            });
        }

        const owner = await discord.getMember(bot.owner.id);
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
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === false)
            return res.status(400).render("status", {
                res,
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
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === false)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueue"),
                req,
                type: "Error"
            });

        if (!req.body.reason && !req.user.db.rank.admin) {
            return res.status(400).render("status", {
                res,
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
                $inc: {
                    "staffTracking.handledBots.allTime.total": 1,
                    "staffTracking.handledBots.allTime.remove": 1,
                    "staffTracking.handledBots.thisWeek.total": 1,
                    "staffTracking.handledBots.thisWeek.remove": 1
                }
            }
        );

        await userCache.updateUser(req.user.id);

        const type = botType(req.body.type);

        await global.db.collection("audit").insertOne({
            type: "REMOVE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            reasonType: type
        });

        await botCache.updateBot(req.params.id);

        const embed = new Discord.EmbedBuilder();
        embed.setColor(0x2f3136);
        embed.setTitle("Reason");
        embed.setDescription(req.body.reason);
        embed.setURL(`${settings.website.url}/bots/${bot._id}`);

        await discord.channels.logs.send({
            content: `${settings.emoji.delete} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` removed bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\``,
            embeds: [embed]
        });

        const member = await discord.getMember(req.params.id);

        if (member && !settings.website.dev) {
            await member
                .kick("Bot has been removed from the website.")
                .catch((e) => {
                    console.error(e);
                });
        }

        const owner = await discord.getMember(bot.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.delete
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
    "/:id/modhide",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const bot: delBot | undefined = await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === false)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueueHide"),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__("premid.bots.hide", bot.name);

        res.render("templates/bots/staffActions/remove", {
            title: res.__("page.bots.hide.title"),
            icon: "eye-slash",
            subtitle: res.__("page.bots.hide.subtitle", bot.name),
            req,
            redirect: `/bots/${bot._id}`
        });
    }
);

router.post(
    "/:id/modhide",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const bot: delBot | undefined = await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === false)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueueHide"),
                req,
                type: "Error"
            });

        if (!req.body.reason && !req.user.db.rank.admin) {
            return res.status(400).render("status", {
                res,
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
                    "status.modHidden": true
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $inc: {
                    "staffTracking.handledBots.allTime.total": 1,
                    "staffTracking.handledBots.allTime.modHidden": 1,
                    "staffTracking.handledBots.thisWeek.total": 1,
                    "staffTracking.handledBots.thisWeek.modHidden": 1
                }
            }
        );

        await userCache.updateUser(req.user.id);

        const type = botType(req.body.type);

        await global.db.collection("audit").insertOne({
            type: "MOD_HIDE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            reasonType: type
        });

        await botCache.updateBot(req.params.id);

        const embed = new Discord.EmbedBuilder();
        embed.setColor(0x2f3136);
        embed.setTitle("Reason");
        embed.setDescription(req.body.reason);
        embed.setURL(`${settings.website.url}/bots/${bot._id}`);

        await discord.channels.logs.send({
            content: `${settings.emoji.hide} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` hid bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\``,
            embeds: [embed]
        });

        const owner = await discord.getMember(bot.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.hide
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been hidden!\n**Reason:** \`${
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
    "/:id/modunhide",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const bot: delBot | undefined = await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (!bot.status.modHidden)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.notHidden"),
                req,
                type: "Error"
            });

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.modHidden": false
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $inc: {
                    "staffTracking.handledBots.allTime.total": 1,
                    "staffTracking.handledBots.thisWeek.total": 1
                }
            }
        );

        await userCache.updateUser(req.user.id);

        discord.channels.logs
            .send(
                `${settings.emoji.unhide} **${functions.escapeFormatting(
                    req.user.db.fullUsername
                )}** \`(${
                    req.user.id
                })\` unhid bot **${functions.escapeFormatting(
                    bot.name
                )}** \`(${bot._id})\`\n<${settings.website.url}/bots/${
                    bot._id
                }>`
            )
            .catch((e) => {
                console.error(e);
            });

        const owner = await discord.getMember(bot.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.check
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been unhidden on the website!`
                )
                .catch((e) => {
                    console.error(e);
                });

        await global.db.collection("audit").insertOne({
            type: "MOD_UNHIDE_BOT",
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
    "/:id/sync",
    variables,
    permission.auth,
    checks.botExists,
    async (req: Request, res: Response) => {
        const bot = req.attached.bot;

        let commands: APIApplicationCommand[] = bot.commands || [];

        if (bot.scopes?.slashCommands && req.user.db.auth) {
            if (Date.now() > req.user.db.auth.expires) {
                await refresh.requestNewAccessToken(
                    "discord",
                    req.user.db.auth.refreshToken,
                    async (
                        err,
                        accessToken,
                        refreshToken,
                        result: RESTPostOAuth2AccessTokenResult
                    ) => {
                        if (err) {
                            let errors: string[] = [];

                            if (functions.isDiscordAPIError(err)) {
                                errors.push(`${err.statusCode} ${err.data}`);
                            } else {
                                errors.push(err.message);
                            }

                            return res.status(500).json({
                                error: true,
                                status: 500,
                                errors: [errors]
                            });
                        } else {
                            await global.db.collection("users").updateOne(
                                { _id: req.user.id },
                                {
                                    $set: {
                                        auth: {
                                            accessToken,
                                            refreshToken,
                                            expires:
                                                Date.now() +
                                                result.expires_in * 1000
                                        }
                                    }
                                }
                            );
                            await userCache.updateUser(req.user.id);
                        }
                    }
                );
            }

            const receivedCommands = (await (
                await fetch(DAPI + Routes.applicationCommands(bot._id), {
                    headers: {
                        authorization: `Bearer ${req.user.db.auth.accessToken}`
                    }
                })
            )
                .json()
                .catch(() => {})) as APIApplicationCommand[];
            if (Array.isArray(receivedCommands)) commands = receivedCommands;
        }

        let userFlags = 0;

        if (bot.scopes?.bot) {
            const user = (await discord.bot.rest
                .get(Routes.user(bot._id))
                .catch(() => {})) as APIUser;
            if (user.public_flags) userFlags = user.public_flags;
        }

        discord.bot.rest
            .get(`/applications/${bot.clientID || req.params.id}/rpc`)
            .then(async (app: APIApplication) => {
                if (app.bot_public === false)
                    // not !app.bot_public; should not trigger when undefined
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notPublic")]
                    });

                await global.db.collection("bots").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            name: app.name,
                            icon: {
                                hash: app.icon,
                                url: `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}`
                            },
                            commands,
                            userFlags
                        } satisfies Partial<delBot>
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
                            name: bot.name,
                            icon: {
                                hash: bot.icon.hash,
                                url: bot.icon.url
                            },
                            commands: bot.commands
                        } satisfies Partial<delBot>,
                        new: {
                            name: app.name,
                            icon: {
                                hash: app.icon,
                                url: `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}`
                            },
                            commands
                        } satisfies Partial<delBot>
                    }
                });

                await botCache.updateBot(req.params.id);

                res.redirect(`/bots/${bot._id}`);
            })
            .catch((error: DiscordAPIError) => {
                if (error.code === RESTJSONErrorCodes.UnknownApplication)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notFound")]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [
                        res.__("common.error.bot.arr.fetchError"),
                        `${error.name}: ${error.message}`,
                        `${error.code} ${error.method} ${error.url}`
                    ]
                });
            });
    }
);

export default router;

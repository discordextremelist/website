import { PathRoute } from "../../route.ts";
import { variables } from "../../../Util/Function/variables.ts";
import * as permission from "../../../Util/Function/permissions.ts";
import e from "express";
import {
    type APIApplication,
    type APIApplicationCommand, type APIUser,
    type DiscordAPIError,
    OAuth2Scopes, RESTJSONErrorCodes,
    type RESTPostOAuth2AccessTokenResult,
    Routes
} from "discord.js";
import * as checks from "../../../Util/Function/checks.ts";
import * as libraryCache from "../../../Util/Services/libCaching.ts";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord.ts";
import * as functions from "../../../Util/Function/main.ts";
import { URL } from "url";
import fetch, { Response as fetchRes } from "node-fetch";
import refresh from "passport-oauth2-refresh";
import * as userCache from "../../../Util/Services/userCaching.ts";
import { DAPI } from "../../../Util/Services/discord.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";

export class GetResubmitBot extends PathRoute<"get"> {

    constructor() {
        super("get", "/:id/resubmit", [variables, permission.auth, permission.scopes([OAuth2Scopes.GuildsJoin]), checks.botExists]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
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

}

export class PostResubmitBot extends PathRoute<"post"> {

    constructor() {
        super("post", "/:id/resubmit", [variables, permission.auth, checks.botExists, permission.member]);
    }

    // @ts-ignore
    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        let error = false;
        let errors: string[] = [];
        const bot = req.attached.bot!;
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

        // Start of new URL checks go here
        // TODO: Check instances and verify they do not 404, invalid, etc.
        // TODO: Improve some of this code below, it is hectic.

        // @ts-expect-error
        if (req.body.mastodon && !patterns.mastodon.test(req.body.mastodon)) { error = true; errors.push(res.__("common.error.listing.edit.mastodonInvalid")) }
        // @ts-expect-error
        if (req.body.bluesky && !patterns.bluesky.test(req.body.bluesky)) { error = true; errors.push(res.__("common.error.listing.edit.blueskyInvalid")) }
        // @ts-expect-error
        if (req.body.gitlab && !patterns.gitlab.test(req.body.gitlab)) { error = true; errors.push(res.__("common.error.listing.edit.gitlabInvalid")) }
        // @ts-expect-error
        if (req.body.forgejo && !patterns.forgejo.test(req.body.forgejo)) { error = true; errors.push(res.__("common.error.listing.edit.forgejoInvalid")) }

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
                                twitter: bot.social?.twitter,

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

}

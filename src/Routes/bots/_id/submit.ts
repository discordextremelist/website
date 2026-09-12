import { PathRoute } from "../../route.ts";
import e from "express";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import {
    type APIApplication,
    type APIApplicationCommand,
    type DiscordAPIError,
    OAuth2Scopes,
    RESTJSONErrorCodes,
    Routes
} from "discord.js";
import * as libraryCache from "../../../Util/Services/libCaching.ts";
import * as discord from "../../../Util/Services/discord.ts";
import * as functions from "../../../Util/Function/main.ts";
import { URL } from "url";

import crypto from "crypto";
import settings from "../../../../settings.json" with { type: "json" };
import * as botCache from "../../../Util/Services/botCaching.ts";
import { blacklistCheck } from "../../../Util/Services/blacklist.ts";
import { patterns } from "../../../Util/Function/patterns.ts";
import {
    botTags,
    descriptionErrors,
    fetchSlashCommands,
    fetchUserFlags,
    invalidLinkErrors,
    parseEditors,
    privacyPolicyErrors,
    widgetbotErrors
} from "../../../Util/Function/botListing.ts";
import { websiteLogMessage } from "../../../Util/Function/main.ts";

export class GetSubmit extends PathRoute<"get"> {
    constructor() {
        super("get", "/submit", [
            variables,
            permission.auth,
            permission.scopes([OAuth2Scopes.GuildsJoin])
        ]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
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
}

export class PostSubmit extends PathRoute<"post"> {
    constructor() {
        super("post", "/submit", [
            variables,
            permission.auth,
            permission.member
        ]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
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

        for (const message of invalidLinkErrors(req.body, res, [
            "supportServer",
            "website",
            "donationUrl",
            "repo"
        ])) {
            error = true;
            errors.push(message);
        }

        if (
            req.body.invite &&
            functions.isURL(req.body.invite) &&
            Number(new URL(req.body.invite).searchParams.get("permissions")) & 8
        ) {
            error = true;
            errors.push(res.__("common.error.listing.arr.inviteHasAdmin"));
        }

        for (const message of invalidLinkErrors(req.body, res, ["banner"])) {
            error = true;
            errors.push(message);
        }

        for (const message of await widgetbotErrors(req.body, res)) {
            error = true;
            errors.push(message);
        }

        if (req.body.twitter?.length > 15) {
            error = true;
            errors.push(res.__("common.error.bot.arr.twitterInvalid"));
        }

        // Start of new URL checks go here
        // TODO: Check instances and verify they do not 404, invalid, etc.
        // TODO: Improve some of this code below, it is hectic.

        if (req.body.mastodon && !patterns.mastodon.test(req.body.mastodon)) {
            error = true;
            // @ts-expect-error TODO(B-8): key does not exist in del-i18n; add it in the socials PR.
            errors.push(res.__("common.error.listing.edit.mastodonInvalid"));
        }
        if (req.body.bluesky && !patterns.bluesky.test(req.body.bluesky)) {
            error = true;
            // @ts-expect-error TODO(B-8): key does not exist in del-i18n; add it in the socials PR.
            errors.push(res.__("common.error.listing.edit.blueskyInvalid"));
        }
        if (req.body.gitlab && !patterns.gitlab.test(req.body.gitlab)) {
            error = true;
            // @ts-expect-error TODO(B-8): key does not exist in del-i18n; add it in the socials PR.
            errors.push(res.__("common.error.listing.edit.gitlabInvalid"));
        }
        if (req.body.forgejo && !patterns.forgejo.test(req.body.forgejo)) {
            error = true;
            // @ts-expect-error TODO(B-8): key does not exist in del-i18n; add it in the socials PR.
            errors.push(res.__("common.error.listing.edit.forgejoInvalid"));
        }

        for (const message of descriptionErrors(req.body, res)) {
            error = true;
            errors.push(message);
        }

        for (const message of privacyPolicyErrors(req.body, res)) {
            error = true;
            errors.push(message);
        }

        const library = libraryCache.hasLib(req.body.library)
            ? req.body.library
            : "Other";

        // TODO: Refractor
        let tags: string[] = botTags(req.body);
        let editors: any[] = parseEditors(req.body.editors);
        if (editors.includes(req.user.id)) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.removeYourselfEditor")
            );
        }

        let commands: APIApplicationCommand[] = await fetchSlashCommands(
            req,
            req.body.id,
            [],
            (message) => {
                error = true;
                errors.push(message);
            }
        );

        let userFlags = await fetchUserFlags(req.body.bot, req.body.id);
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
                        twitter: req.body.twitter,
                        mastodon: req.body.mastodon,
                        bluesky: req.body.bluesky,
                        gitlab: req.body.gitlab,
                        forgejo: req.body.forgejo
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
                    websiteLogMessage(
                        req,
                        settings.emoji.add,
                        "added bot",
                        app.name,
                        req.body.id,
                        `\n<${settings.website.url}/bots/${req.body.id}>`
                    )
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
}

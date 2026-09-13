import { AuthedPathRoute } from "../../route.ts";
import e from "express";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import {
    type APIApplication,
    type DiscordAPIError,
    OAuth2Scopes,
    RESTJSONErrorCodes
} from "discord.js";
import * as libraryCache from "../../../Util/Services/libCaching.ts";
import * as discord from "../../../Util/Services/discord.ts";

import crypto from "crypto";
import settings from "../../../../settings.json" with { type: "json" };
import * as botCache from "../../../Util/Services/botCaching.ts";
import { blacklistCheck } from "../../../Util/Services/blacklist.ts";
import { logWebsiteAction } from "../../../Util/Function/websiteLog.ts";
import {
    discordErrorJson,
    jsonError
} from "../../../Util/Function/responses.ts";
import { validateBotListing } from "../../../Util/Function/botListing.ts";

export class GetSubmit extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/submit", [
            variables,
            permission.auth,
            permission.scopes([OAuth2Scopes.GuildsJoin])
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
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

export class PostSubmit extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/submit", [
            variables,
            permission.auth,
            permission.member
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        res.locals.premidPageInfo = res.__("premid.bots.submit");

        const botExists = await global.db
            .collection("bots")
            .findOne({ _id: req.body.id });

        if (botExists)
            return jsonError(res, 409, [res.__("common.error.bot.conflict")]);

        const { errors, invite, library, tags, editors, commands, userFlags } =
            await validateBotListing(req, res);
        if (errors.length > 0) return jsonError(res, 400, errors);

        discord
            .restGet<APIApplication>(
                `/applications/${req.body.clientID || req.body.id}/rpc`
            )
            .then(async (app: APIApplication) => {
                if (app.bot_public === false)
                    // not !app.bot_public; should not trigger when undefined
                    return jsonError(res, 400, [
                        res.__("common.error.bot.arr.notPublic")
                    ]);

                if (req.body.bot && !("bot_public" in app))
                    return jsonError(res, 400, [
                        res.__("common.error.bot.arr.noBot")
                    ]);

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

                await logWebsiteAction(
                    req,
                    settings.emoji.add,
                    "added bot",
                    app.name,
                    req.body.id,
                    {
                        suffix: `\n<${settings.website.url}/bots/${req.body.id}>`
                    }
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
            .catch((error: DiscordAPIError) =>
                discordErrorJson(
                    res,
                    error,
                    RESTJSONErrorCodes.UnknownApplication,
                    res.__("common.error.bot.arr.notFound"),
                    res.__("common.error.bot.arr.fetchError")
                )
            );
    }
}

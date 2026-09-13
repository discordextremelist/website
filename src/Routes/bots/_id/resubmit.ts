import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import e from "express";
import {
    type APIApplication,
    type APIApplicationCommand,
    type DiscordAPIError,
    OAuth2Scopes,
    RESTJSONErrorCodes,
    Routes
} from "discord.js";
import * as checks from "../../../Util/Middleware/checks.ts";
import * as libraryCache from "../../../Util/Services/libCaching.ts";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord.ts";
import * as functions from "../../../Util/Function/main.ts";
import { URL } from "url";

import * as botCache from "../../../Util/Services/botCaching.ts";
import { patterns } from "../../../Util/Function/patterns.ts";
import { renderStatus } from "../../../Util/Function/main.ts";
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

export class GetResubmitBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/resubmit", [
            variables,
            permission.auth,
            permission.scopes([OAuth2Scopes.GuildsJoin]),
            checks.botExists,
            permission.ownerOrAssistant(
                "bot",
                "common.error.bot.perms.resubmit"
            )
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        if (bot.status.archived === false)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.notArchived")
            );

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

export class PostResubmitBot extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/resubmit", [
            variables,
            permission.auth,
            checks.botExists,
            permission.ownerOrAssistant(
                "bot",
                "common.error.bot.perms.resubmit",
                { json: true }
            ),
            permission.member
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
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

        for (const message of invalidLinkErrors(req.body, res, [
            "supportServer",
            "website",
            "donationUrl",
            "repo",
            "banner"
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
        let tags: string[] = botTags(req.body);
        let editors: any[] = parseEditors(req.body.editors);
        if (editors.includes(req.user.id) && bot.owner.id === req.user.id) {
            error = true;
            errors.push(
                res.__("common.error.listing.arr.removeYourselfEditor")
            );
        }

        let commands: APIApplicationCommand[] = await fetchSlashCommands(
            req,
            bot._id,
            bot.commands || [],
            (message) => {
                error = true;
                errors.push(message);
            }
        );

        let userFlags = await fetchUserFlags(req.body.bot, bot._id);
        if (error === true)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });

        discord
            .restGet<APIApplication>(
                `/applications/${req.body.clientID || req.body.id}/rpc`
            )
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
                            // Older bots only have the deprecated avatar; the
                            // bot page falls back to it, so record that.
                            icon: bot.icon ?? bot.avatar,
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
                            labels: bot.labels
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
                        websiteLogMessage(
                            req,
                            settings.emoji.resubmit,
                            "resubmitted bot",
                            app.name,
                            app.id,
                            `\n<${settings.website.url}/bots/${app.id}>`
                        )
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

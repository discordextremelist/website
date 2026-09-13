import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import e from "express";

import * as libraryCache from "../../../Util/Services/cache/libCaching.ts";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord/index.ts";
import {
    type APIApplication,
    type DiscordAPIError,
    RESTJSONErrorCodes
} from "discord.js";

import * as botCache from "../../../Util/Services/cache/botCaching.ts";
import { blacklistCheck } from "../../../Util/Services/access/blacklist.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import { sanitizeBotHtml } from "../../../Util/Function/web/sanitize.ts";
import { logListingEvent } from "../../../Util/Function/listings/websiteLog.ts";
import {
    discordErrorJson,
    jsonError
} from "../../../Util/Function/web/responses.ts";
import { validateBotListing } from "../../../Util/Function/bots/botListing.ts";
import {
    botAuditAfter,
    botAuditBefore,
    editedBotFields
} from "../../../Util/Function/bots/botRecords.ts";

export class GetEdit extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/edit", [
            variables,
            permission.auth,
            botExists,
            permission.ownerOrAssistant("bot", "common.error.bot.perms.edit", {
                editors: true
            })
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        res.locals.premidPageInfo = res.__("premid.bots.edit", bot.name);

        const clean = sanitizeBotHtml(bot.longDesc);

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
}

export class PostEdit extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/edit", [
            variables,
            botExists,
            permission.auth,
            permission.ownerOrAssistant("bot", "common.error.bot.perms.edit", {
                editors: true,
                json: true
            })
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        res.locals.premidPageInfo = res.__("premid.bots.edit", bot.name);

        const { errors, ...form } = await validateBotListing(req, res, {
            bot,
            inviteScopes: true
        });
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

                await global.db.collection("bots").updateOne(
                    { _id: req.params.id },
                    {
                        $set: editedBotFields(req, app, form)
                    }
                );

                await global.db.collection("audit").insertOne({
                    type: "EDIT_BOT",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        old: botAuditBefore(req, bot),
                        new: botAuditAfter(req, app, form)
                    }
                });
                await botCache.updateBot(req.params.id);

                logListingEvent(
                    req,
                    "bot",
                    "edited",
                    { _id: app.id, name: app.name },
                    { linkId: req.params.id }
                ).catch((e) => {
                    console.error(e);
                });

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

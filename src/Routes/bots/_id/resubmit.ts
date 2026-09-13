import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import e from "express";
import {
    type APIApplication,
    type DiscordAPIError,
    OAuth2Scopes,
    RESTJSONErrorCodes
} from "discord.js";
import * as checks from "../../../Util/Middleware/checks.ts";
import * as libraryCache from "../../../Util/Services/cache/libCaching.ts";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord/index.ts";
import {
    discordErrorJson,
    jsonError,
    renderStatus
} from "../../../Util/Function/web/responses.ts";

import * as botCache from "../../../Util/Services/cache/botCaching.ts";
import { logListingEvent } from "../../../Util/Function/listings/websiteLog.ts";
import { validateBotListing } from "../../../Util/Function/bots/botListing.ts";
import {
    botAuditAfter,
    botAuditBefore,
    resubmittedBotFields
} from "../../../Util/Function/bots/botRecords.ts";
import { recordAudit } from "../../../Util/Function/staff/recordAudit.ts";

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
        const bot = req.attached.bot!;

        if (bot.status.archived === false)
            return jsonError(res, 400, [
                res.__("common.error.bot.notArchived")
            ]);

        res.locals.premidPageInfo = res.__("premid.bots.resubmit", bot.name);

        const { errors, ...form } = await validateBotListing(req, res, { bot });
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
                        $set: resubmittedBotFields(req, app, form)
                    }
                );

                await recordAudit({
                    type: "RESUBMIT_BOT",
                    executor: req.user.id,
                    target: req.params.id,
                    reason: "None specified.",
                    details: {
                        old: botAuditBefore(req, bot, { resubmit: true }),
                        new: botAuditAfter(req, app, form, { resubmit: true })
                    }
                });

                await botCache.updateBot(req.params.id);

                await logListingEvent(req, "bot", "resubmitted", {
                    _id: app.id,
                    name: app.name
                }).catch((e) => {
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

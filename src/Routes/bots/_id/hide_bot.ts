import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import e from "express";
import * as discord from "../../../Util/Services/discord/index.ts";
import settings from "../../../../settings.json" with { type: "json" };
import { escapeFormatting } from "../../../Util/Function/common/format.ts";
import { renderStatus } from "../../../Util/Function/web/responses.ts";
import * as botCache from "../../../Util/Services/cache/botCaching.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import { botType } from "../../../Util/Function/staff/audit.ts";
import { logListingEvent } from "../../../Util/Function/listings/websiteLog.ts";
import {
    reasonMissing,
    recordStaffAction
} from "../../../Util/Function/staff/staffActions.ts";
import { recordAudit } from "../../../Util/Function/staff/recordAudit.ts";

export class HideBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/hide", [
            variables,
            permission.auth,
            botExists,
            permission.ownerOnly("bot", "common.error.bot.perms.notOwner")
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        if (bot.status.approved === false)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.inQueueHide")
            );

        await logListingEvent(req, "bot", "hidden", bot);

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.hidden": true
                }
            }
        );

        await recordAudit({
            type: "HIDE_BOT",
            executor: req.user.id,
            target: req.params.id,
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${bot._id}`);
    }
}

export class UnhideBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/unhide", [
            variables,
            permission.auth,
            botExists,
            permission.ownerOnly("bot", "common.error.bot.perms.notOwner")
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        await logListingEvent(req, "bot", "unhidden", bot);

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.hidden": false
                }
            }
        );

        await recordAudit({
            type: "UNHIDE_BOT",
            executor: req.user.id,
            target: req.params.id,
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${bot._id}`);
    }
}

export class GetModHideBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/modhide", [
            variables,
            permission.auth,
            botExists,
            permission.mod
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        if (bot.status.approved === false)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.inQueueHide")
            );

        res.locals.premidPageInfo = res.__("premid.bots.hide", bot.name);

        res.render("templates/bots/staffActions/remove", {
            title: res.__("page.bots.hide.title"),
            icon: "eye-slash",
            subtitle: res.__("page.bots.hide.subtitle", bot.name),
            req,
            redirect: `/bots/${bot._id}`
        });
    }
}

export class PostModHideBot extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/modhide", [
            variables,
            permission.auth,
            botExists,
            permission.mod
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        if (bot.status.approved === false)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.inQueueHide")
            );

        if (reasonMissing(req, res)) return;

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.modHidden": true
                }
            }
        );

        await recordStaffAction(req.user.id, "Bots", "modHidden");

        const type = botType(req.body.type);

        await recordAudit({
            type: "MOD_HIDE_BOT",
            executor: req.user.id,
            target: req.params.id,
            reason: req.body.reason || "None specified.",
            reasonType: type
        });

        await botCache.updateBot(req.params.id);

        await logListingEvent(req, "bot", "hidden", bot, {
            reason: req.body.reason
        });

        await discord.messageMember(
            bot.owner.id,
            `${settings.emoji.hide} **|** Your bot **${escapeFormatting(
                bot.name
            )}** \`(${bot._id})\` has been hidden!\n**Reason:** \`${
                req.body.reason || "None specified."
            }\``
        );

        res.redirect(`/bots/${bot._id}`);
    }
}

export class GetModUnhideBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/modunhide", [
            variables,
            permission.auth,
            botExists,
            permission.mod
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        if (!bot.status.modHidden)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.notHidden")
            );

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.modHidden": false
                }
            }
        );

        await recordStaffAction(req.user.id, "Bots");

        logListingEvent(req, "bot", "unhidden", bot).catch((e) => {
            console.error(e);
        });

        await discord.messageMember(
            bot.owner.id,
            `${settings.emoji.check} **|** Your bot **${escapeFormatting(
                bot.name
            )}** \`(${bot._id})\` has been unhidden on the website!`
        );

        await recordAudit({
            type: "MOD_UNHIDE_BOT",
            executor: req.user.id,
            target: req.params.id,
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${req.params.id}`);
    }
}

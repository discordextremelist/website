import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import e from "express";
import * as botCache from "../../../Util/Services/botCaching.ts";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord.ts";
import { escapeFormatting } from "../../../Util/Function/format.ts";
import { renderStatus } from "../../../Util/Function/responses.ts";
import { botType } from "../index.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import { logListingEvent } from "../../../Util/Function/websiteLog.ts";
import {
    reasonMissing,
    recordStaffAction
} from "../../../Util/Function/staffActions.ts";

export class GetDeclineBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/decline", [
            variables,
            botExists,
            permission.auth,
            permission.mod
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        res.locals.premidPageInfo = res.__("premid.bots.decline", bot.name);

        if (bot.status.approved === true)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.notInQueue")
            );

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
}

export class PostDeclineBot extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/decline", [
            variables,
            permission.auth,
            botExists,
            permission.mod
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        if (bot.status.approved === true)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.notInQueue")
            );

        if (reasonMissing(req, res)) return;

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

        await recordStaffAction(req.user.id, "Bots", "declined");

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

        await logListingEvent(req, "bot", "declined", bot, {
            reason: req.body.reason || "No reason provided."
        });

        const member = await discord.getTestingGuildMember(req.params.id);

        if (member) {
            await member.kick("Bot's listing has been declined.").catch((e) => {
                console.error(e);
            });
        }

        await discord.messageMember(
            bot.owner.id,
            `${settings.emoji.cross} **|** Your bot **${escapeFormatting(
                bot.name
            )}** \`(${bot._id})\` has been declined.\n**Reason:** \`${
                req.body.reason || "None specified."
            }\``
        );

        res.redirect("/staff/bot_queue");
    }
}

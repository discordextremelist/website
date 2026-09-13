import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import { auth, mod } from "../../../Util/Middleware/permissions.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import e from "express";
import * as botCache from "../../../Util/Services/botCaching.ts";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord.ts";
import { escapeFormatting } from "../../../Util/Function/format.ts";
import { renderStatus } from "../../../Util/Function/responses.ts";
import { botType } from "../index.ts";
import { logListingEvent } from "../../../Util/Function/websiteLog.ts";
import {
    reasonMissing,
    recordStaffAction
} from "../../../Util/Function/staffActions.ts";

export class GetRemoveBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/remove", [variables, auth, botExists, mod]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot: delBot = req.attached.bot!;
        if (bot.status.approved === false)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.inQueue")
            );

        res.locals.premidPageInfo = res.__("premid.bots.remove", bot.name);

        res.render("templates/bots/staffActions/remove", {
            title: res.__("page.bots.remove.title"),
            icon: "trash",
            subtitle: res.__("page.bots.remove.subtitle", bot.name),
            req,
            redirect: `/bots/${bot._id}`
        });
    }
}

export class PostRemoveBot extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/remove", [variables, auth, botExists, mod]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        if (bot.status.approved === false)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.inQueue")
            );

        if (reasonMissing(req, res)) return;

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

        await recordStaffAction(req.user.id, "Bots", "remove");

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

        await logListingEvent(req, "bot", "removed", bot, {
            reason: req.body.reason
        });

        const member = await discord.getMember(req.params.id);

        if (member && !settings.website.dev) {
            await member
                .kick("Bot has been removed from the website.")
                .catch((e) => {
                    console.error(e);
                });
        }

        await discord.messageMember(
            bot.owner.id,
            `${settings.emoji.delete} **|** Your bot **${escapeFormatting(
                bot.name
            )}** \`(${bot._id})\` has been removed!\n**Reason:** \`${
                req.body.reason || "None specified."
            }\``
        );

        res.redirect(`/bots/${bot._id}`);
    }
}

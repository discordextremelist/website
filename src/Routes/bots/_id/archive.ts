import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import e from "express";
import * as discord from "../../../Util/Services/discord.ts";
import settings from "../../../../settings.json" with { type: "json" };
import * as botCache from "../../../Util/Services/botCaching.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import { logWebsiteAction } from "../../../Util/Function/websiteLog.ts";

export class ArchiveBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/archive", [
            variables,
            botExists,
            permission.auth,
            permission.ownerOnly("bot", "common.error.bot.perms.notOwner")
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        await logWebsiteAction(
            req,
            settings.emoji.archive,
            "archived bot",
            bot.name,
            bot._id
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
}

export class DeleteBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/delete", [
            variables,
            botExists,
            permission.auth,
            permission.ownerOnly("bot", "common.error.bot.perms.notOwner")
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        await logWebsiteAction(
            req,
            settings.emoji.delete,
            "deleted bot",
            bot.name,
            bot._id
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
}

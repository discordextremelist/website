import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import e from "express";
import * as discord from "../../../Util/Services/discord/index.ts";
import * as botCache from "../../../Util/Services/cache/botCaching.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import { logListingEvent } from "../../../Util/Function/listings/websiteLog.ts";

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

        await logListingEvent(req, "bot", "archived", bot);

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

        await logListingEvent(req, "bot", "deleted", bot);

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

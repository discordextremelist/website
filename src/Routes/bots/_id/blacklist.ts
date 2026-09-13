import { AuthedPathRoute } from "../../route.ts";
import { admin, auth } from "../../../Util/Middleware/permissions.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import e from "express";
import { blacklistUpdate } from "../../../Util/Services/access/blacklist.ts";
import { updateBot } from "../../../Util/Services/cache/botCaching.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import { renderStatus } from "../../../Util/Function/web/responses.ts";

export class BlacklistBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/blacklist", [variables, auth, admin]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        let bot = await global.db.collection<delBot>("bots").findOne({
            $or: [{ _id: req.params.id }, { vanityUrl: req.params.id }]
        });
        if (!bot) {
            return renderStatus(req, res, 404, res.__("common.error.bot.404"));
        }
        let old_val = bot.status.blacklist ?? false;
        let blacklisted = !(bot.status.blacklist ?? false);
        await global.db.collection("audit").insertOne({
            type: blacklisted ? "BOT_BLACKLIST_ADD" : "BOT_BLACKLIST_REMOVE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: old_val,
                new: blacklisted
            }
        });
        await blacklistUpdate(req.params.id, blacklisted);
        await updateBot(req.params.id);
        return res.redirect(`/bots/${req.params.id}`);
    }
}

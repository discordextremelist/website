import { PathRoute } from "../../route.ts";
import { variables } from "../../../Util/Function/variables.ts";
import * as permission from "../../../Util/Function/permissions.ts";
import * as checks from "../../../Util/Function/checks.ts";
import e from "express";
import crypto from "crypto";
import * as botCache from "../../../Util/Services/botCaching.ts";

export class TokenReset extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/tokenreset", [variables, permission.auth, checks.botExists]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot;

        if (
            bot.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.perms.tokenReset"),
                status: 403,
                type: "Error",
                req
            });

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    token:
                        "DELAPI_" +
                        crypto.randomBytes(16).toString("hex") +
                        `-${req.params.id}`
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "RESET_BOT_TOKEN",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        return res.status(200).render("status", {
            res,
            title: res.__("common.success"),
            subtitle: res.__("common.success.bot.tokenReset"),
            status: 200,
            type: "Success",
            req
        });
    }

}

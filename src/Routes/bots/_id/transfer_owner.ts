import { PathRoute } from "../../route.ts";
import { variables } from "../../../Util/Function/variables.ts";
import * as permission from "../../../Util/Function/permissions.ts";
import * as checks from "../../../Util/Function/checks.ts";
import e from "express";
import * as botCache from "../../../Util/Services/botCaching.ts";

export class TransferOwner extends PathRoute<"post"> {
    constructor() {
        super("post", "/:id/transfer-owner", [variables, permission.assistant, checks.botExists]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot;

        if (req.user.db.rank.assistant === false) {
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                subtitle: res.__("common.error.notAssistant"),
                status: 403,
                type: "Error",
                req
            });
        }

        const newOwnerExists = await global.db
            .collection("users")
            .findOne({ _id: req.body.newOwner });

        if (!newOwnerExists)
            return res.status(422).render("status", {
                res,
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.transferOwnership.422"),
                status: 422,
                type: "Error",
                req
            });

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    owner: {
                        id: req.body.newOwner
                    }
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "MODIFY_OWNER",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: bot.owner.id,
                new: req.body.newOwner
            }
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${req.params.id}`);
    }

}

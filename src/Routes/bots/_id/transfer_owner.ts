import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as checks from "../../../Util/Middleware/checks.ts";
import e from "express";
import * as botCache from "../../../Util/Services/botCaching.ts";
import { renderStatus } from "../../../Util/Function/responses.ts";

export class TransferOwner extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/transfer-owner", [
            variables,
            permission.assistant,
            checks.botExists
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        const newOwnerExists = await global.db
            .collection("users")
            .findOne({ _id: req.body.newOwner });

        if (!newOwnerExists)
            return renderStatus(
                req,
                res,
                422,
                res.__("common.error.bot.transferOwnership.422")
            );

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

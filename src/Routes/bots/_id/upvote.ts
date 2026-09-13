import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import e from "express";
import * as botCache from "../../../Util/Services/cache/botCaching.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import { castVote, voteAuditEntry } from "../../../Util/Function/bots/votes.ts";

export class GetUpvote extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/upvote", [variables, permission.auth, botExists]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        const votes = castVote(bot, req.user.id, "up");

        await global.db
            .collection("audit")
            .insertOne(
                voteAuditEntry(bot, req.user.id, "up", req.params.id, votes)
            );

        await global.db
            .collection("bots")
            .updateOne({ _id: bot._id }, { $set: { votes } });

        await botCache.updateBot(bot._id);

        res.redirect(`/bots/${bot._id}`);
    }
}

export class GetDownvote extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/downvote", [variables, permission.auth, botExists]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        const votes = castVote(bot, req.user.id, "down");

        await global.db
            .collection("bots")
            .updateOne({ _id: bot._id }, { $set: { votes } });

        await global.db
            .collection("audit")
            .insertOne(
                voteAuditEntry(bot, req.user.id, "down", req.params.id, votes)
            );

        await botCache.updateBot(bot._id);

        res.redirect(`/bots/${bot._id}`);
    }
}

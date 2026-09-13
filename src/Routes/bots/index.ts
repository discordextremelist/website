import express, { type Request, type Response, type Router } from "express";
import * as permission from "../../Util/Middleware/permissions.ts";
import { GetSubmit, PostSubmit } from "./_id/submit.ts";
import { GetBot } from "./_id/get.ts";
import { TransferOwner } from "./_id/transfer_owner.ts";
import { SetVanity } from "./_id/set_vanity.ts";
import { GetEdit, PostEdit } from "./_id/edit.ts";
import { TokenReset } from "./_id/token_reset.ts";
import { ReportRoute, SrcRoute } from "./_id/src.ts";
import { ArchiveBot, DeleteBot } from "./_id/archive.ts";
import {
    GetModHideBot,
    GetModUnhideBot,
    HideBot,
    PostModHideBot,
    UnhideBot
} from "./_id/hide_bot.ts";
import { GetResubmitBot, PostResubmitBot } from "./_id/resubmit.ts";
import {
    ApproveBot,
    GetUnapproveBot,
    GivePremiumBot,
    PostUnapproveBot,
    TakePremiumBot
} from "./_id/approve.ts";
import { GetDeclineBot, PostDeclineBot } from "./_id/decline.ts";
import { BlacklistBot } from "./_id/blacklist.ts";
import { GetDownvote, GetUpvote } from "./_id/upvote.ts";
import { GetRemoveBot, PostRemoveBot } from "./_id/remove.ts";
import { SyncBot } from "./_id/sync.ts";
import { GetAccentColor } from "./_id/accent_color.ts";
import { reasonType } from "../../Util/Function/staff/audit.ts";

export function botType(bodyType: string): number {
    return reasonType(bodyType, 15);
}

// Some basic routes do not need their own class.
export const initBotRoutes = (): Router => {
    const router = express.Router();
    router.get("/search", (_req: Request, res: Response) => {
        res.redirect("/search");
    });
    router.get("/:id/exists", permission.auth, async (req, res) => {
        res.type("text").send(
            String(await global.redis?.hexists("bots", req.params.id))
        );
    });
    new GetAccentColor().register(router);
    new GetSubmit().register(router);
    new PostSubmit().register(router);
    new GetBot().register(router);
    new TokenReset().register(router);
    new TransferOwner().register(router);
    new SetVanity().register(router);
    new GetEdit().register(router);
    new PostEdit().register(router);
    new SrcRoute().register(router);
    new ReportRoute().register(router);
    new DeleteBot().register(router);
    new ArchiveBot().register(router);
    new HideBot().register(router);
    new UnhideBot().register(router);
    new GetResubmitBot().register(router);
    new PostResubmitBot().register(router);
    new ApproveBot().register(router);
    new GivePremiumBot().register(router);
    new TakePremiumBot().register(router);
    new GetDeclineBot().register(router);
    new PostDeclineBot().register(router);
    new GetUnapproveBot().register(router);
    new PostUnapproveBot().register(router);
    new BlacklistBot().register(router);
    new GetUpvote().register(router);
    new GetDownvote().register(router);
    new GetModHideBot().register(router);
    new PostModHideBot().register(router);
    new GetModUnhideBot().register(router);
    new GetRemoveBot().register(router);
    new PostRemoveBot().register(router);
    new SyncBot().register(router);
    return router;
};

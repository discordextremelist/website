import express, { type Request, type Response, type Router } from "express";
import { variables } from "../../Util/Function/variables.ts";
import * as permission from "../../Util/Function/permissions.ts";
import * as checks from "../../Util/Function/checks.ts";
import fetch from "node-fetch";
import { Vibrant } from "node-vibrant/node";
import { GetSubmit, PostSubmit } from "./_id/submit.ts";
import { GetBot } from "./_id/get.ts";
import { TransferOwner } from "./_id/transfer_owner.ts";
import { SetVanity } from "./_id/set_vanity.ts";
import { GetEdit, PostEdit } from "./_id/edit.ts";
import { TokenReset } from "./_id/token_reset.ts";
import { ReportRoute, SrcRoute } from "./_id/src.ts";
import { ArchiveBot, DeleteBot } from "./_id/archive.ts";
import { HideBot, UnhideBot } from "./_id/hide_bot.ts";
import { GetResubmitBot, PostResubmitBot } from "./_id/resubmit.ts";
import { ApproveBot, GetUnapproveBot, GivePremiumBot, PostUnapproveBot, TakePremiumBot } from "./_id/approve.ts";
import { GetDeclineBot, PostDeclineBot } from "./_id/decline.ts";
import type { botReasons } from "../../../@types/enums.ts";
import { BlacklistBot } from "./_id/blacklist.ts";

export function botType(bodyType: string): number {
    let type: botReasons = parseInt(bodyType);

    if (type > 15) type = 0;

    return type;
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
    router.get("/:id/accent_color", variables, permission.auth, checks.botExists, async (req: Request, res: Response) => {
        let bot = req.attached.bot;
        if (
            bot.owner.id !== req.user.id &&
            !bot.editors.includes(req.user.id) &&
            req.user.db.rank.mod === false
        )
            return res.status(403).json({
                error: true,
                status: 403,
                errors: [res.__("common.error.bot.perms.edit")]
            });
        let bot_avatar = await fetch(bot.avatar?.url ? bot.avatar!.url : bot.icon!.url);
        if (!bot_avatar.ok) return res.status(403).json({
            error: true,
            status: 403,
            errors: ["Unable to fetch avatar!"] // TODO: Translate
        });
        let palette = (await Vibrant.from(await bot_avatar.buffer()).getPalette()).Vibrant;
        return res.status(200).json({ color: palette.hex });
    });
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
    console.log("Bot routes registered!");
    return router;
};

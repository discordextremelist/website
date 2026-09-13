import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as checks from "../../../Util/Middleware/checks.ts";
import type { Response } from "express";
import fetch from "node-fetch";
import { Vibrant } from "node-vibrant/node";
import { jsonError } from "../../../Util/Function/web/responses.ts";

export class GetAccentColor extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/accent_color", [
            variables,
            permission.auth,
            checks.botExists,
            permission.ownerOrAssistant("bot", "common.error.bot.perms.edit", {
                editors: true,
                json: true,
                staffRank: "mod"
            })
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        let bot = req.attached.bot!;
        let bot_avatar = await fetch(
            bot.avatar?.url ? bot.avatar!.url : bot.icon!.url
        );
        if (!bot_avatar.ok)
            return jsonError(res, 403, [
                "Unable to fetch avatar!" // TODO: Translate
            ]);
        const palette = await Vibrant.from(
            await bot_avatar.buffer()
        ).getPalette();
        // Greyscale or near-flat avatars have no Vibrant swatch, so fall back
        // through the others before giving up.
        const swatch =
            palette.Vibrant ??
            palette.Muted ??
            palette.DarkVibrant ??
            palette.LightVibrant ??
            palette.DarkMuted ??
            palette.LightMuted;
        if (!swatch)
            return jsonError(res, 422, [
                "Unable to pick a colour from the avatar!" // TODO: Translate
            ]);
        return res.status(200).json({ color: swatch.hex });
    }
}

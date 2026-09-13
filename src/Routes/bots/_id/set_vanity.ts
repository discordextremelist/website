import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as checks from "../../../Util/Middleware/checks.ts";
import e from "express";
import * as botCache from "../../../Util/Services/botCaching.ts";
import settings from "../../../../settings.json" with { type: "json" };
import { botExists } from "../../../Util/Middleware/checks.ts";
import { renderStatus } from "../../../Util/Function/main.ts";

export class SetVanity extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/setvanity", [
            variables,
            permission.auth,
            checks.botExists,
            permission.ownerOrAssistant("bot", "common.error.bot.perms.vanity")
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        if (
            req.body.vanity.includes(".") ||
            req.body.vanity.includes("/") ||
            req.body.vanity.includes("\\") ||
            (settings.website.bannedVanityURLs &&
                // The list is empty in settings.example.json, so the JSON
                // import types it never[]; real configs list strings.
                (settings.website.bannedVanityURLs as string[]).includes(
                    req.body.vanity.toLowerCase()
                ))
        )
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.vanity.blacklisted")
            );

        const bots = await botCache.getAllBots();
        for (const bot of bots) {
            if (req.body.vanity === bot.vanityUrl)
                return renderStatus(
                    req,
                    res,
                    409,
                    res.__("common.error.bot.vanity.conflict")
                );
        }

        if (bot.vanityUrl) {
            if (req.body.vanity.split(" ").length !== 1)
                return renderStatus(
                    req,
                    res,
                    400,
                    res.__("common.error.bot.vanity.tooLong")
                );

            if (req.body.vanity === bot.vanityUrl)
                return renderStatus(
                    req,
                    res,
                    400,
                    res.__("common.error.bot.vanity.same")
                );

            await global.db.collection("bots").updateOne(
                { _id: req.params.id },
                {
                    $set: {
                        vanityUrl: req.body.vanity.toLowerCase()
                    }
                }
            );

            await global.db.collection("audit").insertOne({
                type: "MODIFY_VANITY",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: req.body.reason || "None specified.",
                details: {
                    old: bot.vanityUrl,
                    new: req.body.vanity
                }
            });
            await botCache.updateBot(req.params.id);

            res.redirect(`/bots/${req.params.id}`);
        } else if (!bot.vanityUrl) {
            if (req.body.vanity.split(" ").length !== 1)
                return renderStatus(
                    req,
                    res,
                    400,
                    res.__("common.error.bot.vanity.tooLong")
                );

            await global.db.collection("bots").updateOne(
                { _id: req.params.id },
                {
                    $set: {
                        vanityUrl: req.body.vanity.toLowerCase()
                    }
                }
            );

            await global.db.collection("audit").insertOne({
                type: "SET_VANITY",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: req.body.reason || "None specified.",
                details: {
                    old: "Not available.",
                    new: req.body.vanity
                }
            });

            await botCache.updateBot(req.params.id);

            res.redirect(`/bots/${req.params.id}`);
        }
    }
}

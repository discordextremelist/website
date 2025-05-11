import { PathRoute } from "../../route.ts";
import { variables } from "../../../Util/Function/variables.ts";
import * as permission from "../../../Util/Function/permissions.ts";
import * as checks from "../../../Util/Function/checks.ts";
import e from "express";
import * as botCache from "../../../Util/Services/botCaching.ts";
import settings from "../../../../settings.json" with { type: "json" };

export class SetVanity extends PathRoute<"post"> {
    constructor() {
        super("post", "/:id/setvanity", [variables, permission.auth, checks.botExists]);
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
                subtitle: res.__("common.error.bot.perms.vanity"),
                status: 403,
                type: "Error",
                req
            });

        if (
            req.body.vanity.includes(".") ||
            req.body.vanity.includes("/") ||
            req.body.vanity.includes("\\") ||
            (settings.website.bannedVanityURLs &&
                settings.website.bannedVanityURLs.includes(
                    req.body.vanity.toLowerCase()
                ))
        )
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.vanity.blacklisted"),
                status: 400,
                type: "Error",
                req
            });

        const bots = await botCache.getAllBots();
        for (const bot of bots) {
            if (req.body.vanity === bot.vanityUrl)
                return res.status(409).render("status", {
                    res,
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.conflict"),
                    status: 409,
                    type: "Error",
                    req
                });
        }

        if (bot.vanityUrl) {
            if (req.body.vanity.split(" ").length !== 1)
                return res.status(400).render("status", {
                    res,
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.tooLong"),
                    status: 400,
                    type: "Error",
                    req
                });

            if (req.body.vanity === bot.vanityUrl)
                return res.status(400).render("status", {
                    res,
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.same"),
                    status: 400,
                    type: "Error",
                    req
                });

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
                return res.status(400).render("status", {
                    res,
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.tooLong"),
                    status: 400,
                    type: "Error",
                    req
                });

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

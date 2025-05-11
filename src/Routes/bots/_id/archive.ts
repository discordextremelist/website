import { PathRoute } from "../../route.ts";
import { variables } from "../../../Util/Function/variables.ts";
import * as permission from "../../../Util/Function/permissions.ts";
import e from "express";
import * as discord from "../../../Util/Services/discord.ts";
import settings from "../../../../settings.json" with { type: "json" };
import * as functions from "../../../Util/Function/main.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";

export class ArchiveBot extends PathRoute<"get"> {

    constructor() {
        super("get", "/:id/archive", [variables, permission.auth]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {}

}

export class DeleteBot extends PathRoute<"get"> {

    constructor() {
        super("get", "/:id/delete", [variables, permission.auth]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        let bot = await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id });

        if (!bot) {
            bot = await global.db
                .collection<delBot>("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    res,
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
                    type: "Error",
                    req: req
                });
        }

        if (!req.user || req.user.id !== bot.owner.id)
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__("common.error.bot.perms.notOwner"),
                type: "Error",
                user: req.user,
                req: req
            });

        await discord.channels.logs.send(
            `${settings.emoji.delete} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` deleted bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\``
        );

        await global.db.collection("bots").deleteOne({ _id: req.params.id });

        await global.db.collection("audit").insertOne({
            type: "DELETE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.deleteBot(req.params.id);

        await discord.postWebMetric("bot");

        res.redirect("/users/@me");
    }

}

import { PathRoute } from "../../route.ts";
import { variables } from "../../../Util/Function/variables.ts";
import * as permission from "../../../Util/Function/permissions.ts";
import e from "express";
import * as discord from "../../../Util/Services/discord.ts";
import settings from "../../../../settings.json" with { type: "json" };
import * as functions from "../../../Util/Function/main.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";
import { botExists } from "../../../Util/Function/checks.ts";

export class HideBot extends PathRoute<"get"> {

    constructor() {
        super("get", "/:id/hide", [variables, permission.auth]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        let bot = (await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id })) as delBot;

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

        if (bot.status.approved === false)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueueHide"),
                req,
                type: "Error"
            });

        await discord.channels.logs.send(
            `${settings.emoji.hide} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` hid bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\``
        );

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.hidden": true
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "HIDE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${bot._id}`);
    }

}

export class UnhideBot extends PathRoute<"get"> {

    constructor() {
        super("get", "/:id/unhide", [variables, permission.auth]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        let bot = (await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id })) as delBot;

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
            `${settings.emoji.unhide} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` unhid bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\``
        );

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.hidden": false
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "UNHIDE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${bot._id}`);
    }

}

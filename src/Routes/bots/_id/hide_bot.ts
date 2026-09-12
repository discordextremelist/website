import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import e from "express";
import * as discord from "../../../Util/Services/discord.ts";
import settings from "../../../../settings.json" with { type: "json" };
import * as functions from "../../../Util/Function/main.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import * as userCache from "../../../Util/Services/userCaching.js";
import * as Discord from "discord.js";
import { botType } from "../index.js";
import { renderStatus } from "../../../Util/Function/main.ts";
import { websiteLogMessage } from "../../../Util/Function/main.ts";

export class HideBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/hide", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        let bot = (await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id })) as delBot;

        if (!bot) {
            bot = await global.db
                .collection<delBot>("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return renderStatus(
                    req,
                    res,
                    404,
                    res.__("common.error.bot.404")
                );
        }

        if (!req.user || req.user.id !== bot.owner.id)
            return renderStatus(
                req,
                res,
                403,
                res.__("common.error.bot.perms.notOwner"),
                { user: req.user }
            );

        if (bot.status.approved === false)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.inQueueHide")
            );

        await discord.channels.logs.send(
            websiteLogMessage(
                req,
                settings.emoji.hide,
                "hid bot",
                bot.name,
                bot._id
            )
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

export class UnhideBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/unhide", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        let bot = (await global.db
            .collection<delBot>("bots")
            .findOne({ _id: req.params.id })) as delBot;

        if (!bot) {
            bot = await global.db
                .collection<delBot>("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return renderStatus(
                    req,
                    res,
                    404,
                    res.__("common.error.bot.404")
                );
        }

        if (!req.user || req.user.id !== bot.owner.id)
            return renderStatus(
                req,
                res,
                403,
                res.__("common.error.bot.perms.notOwner"),
                { user: req.user }
            );

        await discord.channels.logs.send(
            websiteLogMessage(
                req,
                settings.emoji.unhide,
                "unhid bot",
                bot.name,
                bot._id
            )
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

export class GetModHideBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/modhide", [
            variables,
            permission.auth,
            botExists,
            permission.mod
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        if (bot.status.approved === false)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.inQueueHide")
            );

        res.locals.premidPageInfo = res.__("premid.bots.hide", bot.name);

        res.render("templates/bots/staffActions/remove", {
            title: res.__("page.bots.hide.title"),
            icon: "eye-slash",
            subtitle: res.__("page.bots.hide.subtitle", bot.name),
            req,
            redirect: `/bots/${bot._id}`
        });
    }
}

export class PostModHideBot extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/modhide", [
            variables,
            permission.auth,
            botExists,
            permission.mod
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        if (bot.status.approved === false)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.inQueueHide")
            );

        if (!req.body.reason && !req.user.db.rank.admin) {
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.reasonRequired")
            );
        }

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.modHidden": true
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $inc: {
                    "staffTracking.handledBots.allTime.total": 1,
                    "staffTracking.handledBots.allTime.modHidden": 1,
                    "staffTracking.handledBots.thisWeek.total": 1,
                    "staffTracking.handledBots.thisWeek.modHidden": 1
                }
            }
        );

        await userCache.updateUser(req.user.id);

        const type = botType(req.body.type);

        await global.db.collection("audit").insertOne({
            type: "MOD_HIDE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            reasonType: type
        });

        await botCache.updateBot(req.params.id);

        const embed = new Discord.EmbedBuilder();
        embed.setColor(0x2f3136);
        embed.setTitle("Reason");
        embed.setDescription(req.body.reason);
        embed.setURL(`${settings.website.url}/bots/${bot._id}`);

        await discord.channels.logs.send({
            content: websiteLogMessage(
                req,
                settings.emoji.hide,
                "hid bot",
                bot.name,
                bot._id
            ),
            embeds: [embed]
        });

        const owner = await discord.getMember(bot.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.hide
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been hidden!\n**Reason:** \`${
                        req.body.reason || "None specified."
                    }\``
                )
                .catch((e) => {
                    console.error(e);
                });

        res.redirect(`/bots/${bot._id}`);
    }
}

export class GetModUnhideBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/modunhide", [
            variables,
            permission.auth,
            botExists,
            permission.mod
        ]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        if (!bot.status.modHidden)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.notHidden")
            );

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.modHidden": false
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $inc: {
                    "staffTracking.handledBots.allTime.total": 1,
                    "staffTracking.handledBots.thisWeek.total": 1
                }
            }
        );

        await userCache.updateUser(req.user.id);

        discord.channels.logs
            .send(
                websiteLogMessage(
                    req,
                    settings.emoji.unhide,
                    "unhid bot",
                    bot.name,
                    bot._id,
                    `\n<${settings.website.url}/bots/${bot._id}>`
                )
            )
            .catch((e) => {
                console.error(e);
            });

        const owner = await discord.getMember(bot.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.check
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been unhidden on the website!`
                )
                .catch((e) => {
                    console.error(e);
                });

        await global.db.collection("audit").insertOne({
            type: "MOD_UNHIDE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${req.params.id}`);
    }
}

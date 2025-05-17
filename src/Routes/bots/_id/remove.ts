import { PathRoute } from "../../route.ts";
import { variables } from "../../../Util/Function/variables.ts";
import { auth } from "../../../Util/Function/permissions.ts";
import { botExists } from "../../../Util/Function/checks.ts";
import e from "express";
import * as userCache from "../../../Util/Services/userCaching.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";
import * as Discord from "discord.js";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord.ts";
import * as functions from "../../../Util/Function/main.ts";
import { botType } from "../index.ts";

export class GetRemoveBot extends PathRoute<"get"> {

    constructor() {
        super("get", "/:id/remove", [variables, botExists, auth]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        const bot: delBot = req.attached.bot!;
        if (bot.status.approved === false)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueue"),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__("premid.bots.remove", bot.name);

        res.render("templates/bots/staffActions/remove", {
            title: res.__("page.bots.remove.title"),
            icon: "trash",
            subtitle: res.__("page.bots.remove.subtitle", bot.name),
            req,
            redirect: `/bots/${bot._id}`
        });
    }

}

export class PostRemoveBot extends PathRoute<"post"> {

    constructor() {
        super("post", "/:id/remove", [variables, botExists, auth]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        if (bot.status.approved === false)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueue"),
                req,
                type: "Error"
            });

        if (!req.body.reason && !req.user.db.rank.admin) {
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.reasonRequired"),
                req,
                type: "Error"
            });
        }

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    vanityUrl: "",
                    "status.archived": true,
                    "status.approved": false
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $inc: {
                    "staffTracking.handledBots.allTime.total": 1,
                    "staffTracking.handledBots.allTime.remove": 1,
                    "staffTracking.handledBots.thisWeek.total": 1,
                    "staffTracking.handledBots.thisWeek.remove": 1
                }
            }
        );

        await userCache.updateUser(req.user.id);

        const type = botType(req.body.type);

        await global.db.collection("audit").insertOne({
            type: "REMOVE_BOT",
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
            content: `${settings.emoji.delete} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` removed bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\``,
            embeds: [embed]
        });

        const member = await discord.getMember(req.params.id);

        if (member && !settings.website.dev) {
            await member
                .kick("Bot has been removed from the website.")
                .catch((e) => {
                    console.error(e);
                });
        }

        const owner = await discord.getMember(bot.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.delete
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been removed!\n**Reason:** \`${
                        req.body.reason || "None specified."
                    }\``
                )
                .catch((e) => {
                    console.error(e);
                });

        res.redirect(`/bots/${bot._id}`);
    }

}

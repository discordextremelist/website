import { PathRoute } from "../../route.ts";
import { variables } from "../../../Util/Function/variables.ts";
import { admin, auth } from "../../../Util/Function/permissions.ts";
import e from "express";
import * as tokenManager from "../../../Util/Services/adminTokenManager.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";
import * as Discord from "discord.js";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord.ts";
import * as functions from "../../../Util/Function/main.ts";
import { botExists } from "../../../Util/Function/checks.ts";

export class SrcRoute extends PathRoute<"get"> {

    constructor() {
        super("get", "/:id/src", [variables, auth, admin]);
    }

    //@ts-ignore
    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        if (req.params.id === "@me") {
            if (!req.user) return res.redirect("/auth/login");
            req.params.id = req.user.id;
        }
        if (!req.query.token) return res.json({});
        const tokenCheck = await tokenManager.verifyToken(
            req.user.id,
            req.query.token as string
        );
        if (tokenCheck === false) return res.json({});
        const cache = await botCache.getBot(req.params.id);
        const db = await global.db
            .collection("bots")
            .findOne({ _id: req.params.id });
        res.json({ cache: cache, db: db });
    }

}

export class ReportRoute extends PathRoute<"post"> {

    constructor() {
        super("post", "/:id/report", [variables, auth, botExists]);
    }

    // @ts-ignore
    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        if (bot.owner.id === req.user.id)
            return res.status(403).json({
                error: true,
                status: 403,
                message: res.__("common.error.report.self")
            });

        try {
            const embed = new Discord.EmbedBuilder();
            embed.setColor(0x2f3136);
            embed.setTitle("Bot Report");
            embed.setURL(`${settings.website.url}/bots/${bot._id}`);
            embed.addFields(
                {
                    name: "Reason",
                    value: req.body.reason ? req.body.reason : "None provided."
                },
                {
                    name: "Additional information",
                    value: req.body.additionalInfo
                        ? req.body.additionalInfo
                        : "None provided."
                }
            );

            await discord.channels.alerts.send({
                content: `${settings.emoji.report} **${functions.escapeFormatting(
                    req.user.db.fullUsername
                )}** \`(${
                    req.user.id
                })\` reported bot **${functions.escapeFormatting(
                    bot.name
                )}** \`(${bot._id})\``,
                embeds: [embed]
            });

            return res.status(200).json({
                error: false,
                status: 200,
                message: res.__("common.report.done")
            });
        } catch (e) {
            return res.status(500).json({
                error: true,
                status: 500,
                message: res.__("common.error.report")
            });
        }
    }

}

import { PathRoute } from "../../route.ts";
import { variables } from "../../../Util/Function/variables.ts";
import * as permission from "../../../Util/Function/permissions.ts";
import e from "express";
import * as userCache from "../../../Util/Services/userCaching.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";
import * as Discord from "discord.js";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord.ts";
import * as functions from "../../../Util/Function/main.ts";
import { botType } from "../index.ts";
import { botExists } from "../../../Util/Function/checks.ts";

export class ApproveBot extends PathRoute<"post"> {
    constructor() {
        super("post", "/:id/approve", [
            variables,
            permission.auth,
            botExists,
            permission.mod
        ]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        if (bot.status.approved === true)
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.alreadyApproved"),
                req,
                type: "Error"
            });

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.approved": true,
                    "date.approved": Date.now()
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $inc: {
                    "staffTracking.handledBots.allTime.total": 1,
                    "staffTracking.handledBots.allTime.approved": 1,
                    "staffTracking.handledBots.thisWeek.total": 1,
                    "staffTracking.handledBots.thisWeek.approved": 1
                }
            }
        );

        await userCache.updateUser(req.user.id);

        await discord.channels.logs
            .send(
                `${settings.emoji.check} **${functions.escapeFormatting(
                    req.user.db.fullUsername
                )}** \`(${
                    req.user.id
                })\` approved bot **${functions.escapeFormatting(
                    bot.name
                )}** \`(${bot._id})\`\n<${settings.website.url}/bots/${
                    bot._id
                }>`
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
                    )}** \`(${bot._id})\` has been approved on the website!${
                        !bot.scopes || bot.scopes.bot
                            ? "\n\nYour bot will be added to our server within the next 24 hours."
                            : ""
                    }`
                )
                .catch((e) => {
                    console.error(e);
                });

        const mainGuildOwner = await discord.getMember(bot.owner.id);
        if (mainGuildOwner)
            mainGuildOwner.roles
                .add(settings.roles.developer, "User's bot was just approved.")
                .catch(async (e) => {
                    console.error(e);
                    await discord.channels.alerts.send(
                        `${settings.emoji.error} Failed giving <@${bot.owner.id}> \`${bot.owner.id}\` the role **Bot Developer** upon one of their bots being approved.`
                    );
                });

        const mainGuildBot = await discord.getMember(bot._id);
        if (mainGuildBot)
            mainGuildBot.roles
                .add(settings.roles.bot, "Bot was approved on the website.")
                .catch(async (e) => {
                    console.error(e);
                    await discord.channels.alerts.send(
                        `${settings.emoji.error} Failed giving <@${bot._id}> \`${bot._id}\` the role **Bot** upon being approved on the website.`
                    );
                });

        const botStaffServer = await discord.getTestingGuildMember(bot._id);
        if (botStaffServer)
            botStaffServer
                .kick("Bot was approved on the website.")
                .catch(async (e) => {
                    console.error(e);
                    await discord.channels.alerts.send(
                        `${settings.emoji.error} Failed kicking <@${bot._id}> \`${bot._id}\` from the Testing Server on approval.`
                    );
                });

        await global.db.collection("audit").insertOne({
            type: "APPROVE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${req.params.id}`);
    }
}

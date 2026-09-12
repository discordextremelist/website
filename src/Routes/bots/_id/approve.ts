import { PathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import e from "express";
import * as userCache from "../../../Util/Services/userCaching.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";
import * as Discord from "discord.js";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord.ts";
import * as functions from "../../../Util/Function/main.ts";
import { botType } from "../index.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import { renderStatus } from "../../../Util/Function/main.ts";

export class ApproveBot extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/approve", [
            variables,
            permission.auth,
            botExists,
            permission.mod
        ]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        if (bot.status.approved === true)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.alreadyApproved")
            );

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

export class GivePremiumBot extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/give-premium", [
            variables,
            permission.auth,
            botExists,
            permission.assistant
        ]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        if (bot.status.premium === true)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.alreadyPremium")
            );

        const botMember = await discord.getMember(bot._id);

        if (botMember)
            botMember.roles
                .add(
                    settings.roles.premiumBot,
                    "Bot was given premium on the website."
                )
                .catch(async (e) => {
                    console.error(e);
                    await discord.channels.alerts.send(
                        `${settings.emoji.error} Failed giving <@${botMember.id}> \`${botMember.id}\` the role **Premium Bot** upon being given premium on the website.`
                    );
                });

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.premium": true
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: bot.owner.id },
            {
                $set: {
                    "status.premium": true
                }
            }
        );

        await botCache.updateBot(req.params.id);

        await global.db.collection("audit").insertOne({
            type: "PREMIUM_BOT_GIVE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        res.redirect(`/bots/${req.params.id}`);
    }
}

export class TakePremiumBot extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/take-premium", [
            variables,
            permission.auth,
            botExists,
            permission.assistant
        ]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        if (bot.status.premium === false)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.noPremiumTake")
            );

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.premium": false
                }
            }
        );

        await botCache.updateBot(req.params.id);

        await global.db.collection("audit").insertOne({
            type: "PREMIUM_BOT_TAKE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        res.redirect(`/bots/${req.params.id}`);
    }
}

export class GetUnapproveBot extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/unapprove", [
            variables,
            permission.auth,
            botExists,
            permission.mod
        ]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        if (!bot.status.approved)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.alreadyNotApproved")
            );

        res.locals.premidPageInfo = res.__("premid.bots.unapprove", bot.name);

        res.render("templates/bots/staffActions/remove", {
            title: res.__("page.bots.unapprove.title"),
            icon: "minus",
            subtitle: res.__("page.bots.unapprove.subtitle", bot.name),
            req,
            redirect: `/bots/${bot._id}`
        });
    }
}

export class PostUnapproveBot extends PathRoute<"post"> {
    constructor() {
        super("post", "/:id/unapprove", [
            variables,
            permission.auth,
            botExists,
            permission.mod
        ]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;

        if (!bot.status.approved)
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.bot.inQueue")
            );

        if (!req.body.reason && !req.user.db.rank.admin) {
            return renderStatus(
                req,
                res,
                400,
                res.__("common.error.reasonRequired")
            );
        }

        const type = botType(req.body.type);

        await global.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    vanityUrl: "",
                    "status.approved": false,
                    "date.approved": null
                }
            }
        );

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $inc: {
                    "staffTracking.handledBots.allTime.total": 1,
                    "staffTracking.handledBots.allTime.unapprove": 1,
                    "staffTracking.handledBots.thisWeek.total": 1,
                    "staffTracking.handledBots.thisWeek.unapprove": 1
                }
            }
        );

        await userCache.updateUser(req.user.id);

        await global.db.collection("audit").insertOne({
            type: "UNAPPROVE_BOT",
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
            content: `${settings.emoji.unapprove} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` unapproved bot **${functions.escapeFormatting(
                bot.name
            )}** \`(${bot._id})\``,
            embeds: [embed]
        });

        const member = await discord.getMember(req.params.id);

        if (member && !settings.website.dev) {
            await member.kick("Bot has been unapproved.").catch((e) => {
                console.error(e);
            });
        }

        const owner = await discord.getMember(bot.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.unapprove
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been unapproved!\n**Reason:** \`${
                        req.body.reason || "None specified."
                    }\``
                )
                .catch((e) => {
                    console.error(e);
                });

        res.redirect(`/bots/${bot._id}`);
    }
}

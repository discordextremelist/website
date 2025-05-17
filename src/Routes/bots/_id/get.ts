import { PathRoute } from "../../route.ts";
import e from "express";
import { variables } from "../../../Util/Function/variables.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";
import * as userCache from "../../../Util/Services/userCaching.ts";
import * as discord from "../../../Util/Services/discord.ts";
import entities from "html-entities";
import sanitizeHtml from "sanitize-html";
import htmlRef from "../../../../htmlReference.json" with { type: "json" };
import settings from "../../../../settings.json" with { type: "json" };
import { PresenceUpdateStatus, UserFlags } from "discord.js";
import * as functions from "../../../Util/Function/main.ts";
import mdi from "markdown-it";
import { botExists } from "../../../Util/Function/checks.ts";

const md = new mdi();

export class GetBot extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id", [variables]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        res.locals.pageType = {
            server: false,
            bot: true,
            template: false
        };

        let bot = await botCache.getBot(req.params.id);

        if (!bot) {
            bot = await global.db
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
                        req: req,
                        pageType: { server: false, bot: false }
                    });
            }
        }

        if (
            bot.status.archived &&
            req.user?.id !== bot.owner.id &&
            !req.user?.db.rank.mod
        )
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__("common.error.bot.archived"),
                type: "Error",
                req: req,
                pageType: { server: false, bot: false }
            });

        res.locals.premidPageInfo = res.__("premid.bots.view", bot.name);

        let botOwner = await userCache.getUser(bot.owner.id);
        if (!botOwner) {
            botOwner = await global.db
                .collection<delUser>("users")
                .findOne({ _id: bot.owner.id });
        }

        let botStatus = await discord.getStatus(bot._id);

        const dirty = entities.decode(md.render(bot.longDesc));

        const clean = sanitizeHtml(dirty, {
            allowedTags: htmlRef.standard.tags,
            allowedAttributes: htmlRef.standard.attributes,
            allowVulnerableTags: true,
            disallowedTagsMode: "recursiveEscape",
            transformTags: {
                iframe: function (_tagName, attribs) {
                    attribs.sandbox = "";
                    return {
                        tagName: "iframe",
                        attribs: attribs
                    };
                }
            }
        });

        function sen(name: string) {
            return sanitizeHtml(name, {
                allowedTags: [],
                allowedAttributes: {},
                allowVulnerableTags: false
            });
        }

        let editors = "";
        let looped = 0;
        let editorsLength = bot.editors.length;

        for (const editor of bot.editors) {
            const user = await userCache.getUser(editor);
            looped += 1;

            if (user) {
                editorsLength !== looped
                    ? (editors += `<a class="has-text-white" href="${
                        settings.website.url
                    }${res.locals.linkPrefix}/users/${user._id}">${
                        sen(user.fullUsername) || "Unknown#0000"
                    }</a>,&nbsp;`)
                    : (editors += `<a class="has-text-white" href="${
                        settings.website.url
                    }${res.locals.linkPrefix}/users/${user._id}">${
                        sen(user.fullUsername) || "Unknown#0000"
                    }</a>`);
            } else {
                if (editorsLength === looped)
                    editors = editors.substring(0, editors.length - 2);
            }
        }

        res.render("templates/bots/view", {
            title: `${bot.name} | ${res.__("common.bots.discord")}`,
            subtitle: bot.shortDesc,
            bot: bot,
            showStatus:
                botStatus !== PresenceUpdateStatus.Offline ||
                ((!bot.scopes || bot.scopes.bot) &&
                    (!("userFlags" in bot) ||
                        !(bot.userFlags && UserFlags.BotHTTPInteractions))),
            longDesc: clean,
            botOwner: botOwner,
            botStatus: botStatus,
            mainServer: settings.guild.main,
            staffServer: settings.guild.staff,
            botServer: settings.guild.bot,
            webUrl: settings.website.url,
            req: req,
            editors,
            votes: bot.votes.positive.length - bot.votes.negative.length,
            functions,
            privacyIsURL: functions.isURL(bot.links.privacyPolicy),
            scopes: functions.parseScopes(bot.scopes)
        });
    }

}

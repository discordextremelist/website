/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020-2025 Carolina Mitchell, John Burke, Advaith Jagathesan

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { Request, Response } from "express";
import { PathRoute } from "../route.ts";
import * as botCache from "../../Util/Services/cache/botCaching.ts";
import { variables } from "../../Util/Middleware/variables.ts";
import type {
    BotTags,
    BotQueryTagFilterParams
} from "../../Util/Function/common/types.ts";

const commonFilter = ({ status, labels }: delBot, req: Request) =>
    status.approved &&
    !status.siteBot &&
    !status.archived &&
    !status.hidden &&
    !status.modHidden &&
    !status.blacklist &&
    (!req.user?.db?.preferences.hideNSFW || !labels?.nsfw);

const tagMap: Record<BotTags, BotQueryTagFilterParams> = {
    slashcommands: {
        icon: "fa-slash fa-flip-horizontal has-text-blurple",
        title: "common.bots.title.applicationCommands",
        subtitle: (res) =>
            res.__("common.bots.subtitle.filter.applicationCommands", {
                a: '<a class="has-text-info" href="https://support.discord.com/hc/en-us/articles/1500000368501-Slash-Commands-FAQ" target="_blank" rel="noopener">',
                a2: '<a class="has-text-info" href="https://discord.com/developers/docs/interactions/application-commands#user-commands" target="_blank" rel="noopener">',
                ea: "</a>"
            }),
        filter: (bot, req) => bot.scopes?.slashCommands ?? false
    },
    fun: {
        icon: "fa-grin-squint-tears has-text-link",
        title: "common.bots.title.fun",
        subtitle: (res) => res.__("common.bots.subtitle.filter.fun"),
        filter: (bot, req) => bot.tags.includes("Fun")
    },
    social: {
        icon: "fa-comments-alt has-text-info",
        title: "common.bots.title.social",
        subtitle: (res) => res.__("common.bots.subtitle.filter.social"),
        filter: (bot, req) => bot.tags.includes("Social")
    },
    economy: {
        icon: "fa-comments-dollar has-text-success",
        title: "common.bots.title.economy",
        subtitle: (res) => res.__("common.bots.subtitle.filter.economy"),
        filter: (bot, req) => bot.tags.includes("Economy")
    },
    utility: {
        icon: "fa-cogs has-text-orange",
        title: "common.bots.title.utility",
        subtitle: (res) => res.__("common.bots.subtitle.filter.utility"),
        filter: (bot, req) => bot.tags.includes("Utility")
    },
    moderation: {
        icon: "fa-gavel has-text-danger",
        title: "common.bots.title.moderation",
        subtitle: (res) => res.__("common.bots.subtitle.filter.moderation"),
        filter: (bot, req) => bot.tags.includes("Moderation")
    },
    multipurpose: {
        icon: "fa-ball-pile has-text-magenta",
        title: "common.bots.title.multipurpose",
        subtitle: (res) => res.__("common.bots.subtitle.filter.multipurpose"),
        filter: (bot, req) => bot.tags.includes("Multipurpose")
    },
    music: {
        icon: "fa-comment-music has-text-pink",
        title: "common.bots.title.music",
        subtitle: (res) => res.__("common.bots.subtitle.filter.music"),
        filter: (bot, req) => bot.tags.includes("Music")
    }
};

/** The bot list, optionally filtered by `?tag=`. */
export class GetBots extends PathRoute<"get"> {
    constructor() {
        super("get", "/", [variables]);
    }

    async handle(req: Request, res: Response) {
        res.locals.premidPageInfo = res.__("premid.bots");
        if (!req.query.page) req.query.page = "1";
        let icon = "fa-robot has-text-default";
        let title = res.__("common.bots.discord");
        let subtitle = res.__("common.bots.subtitle");
        let pageParam = "?page=";
        let bots = (await botCache.getAllBots()).filter((bot) =>
            commonFilter(bot, req)
        );
        if (req.query.tag) {
            pageParam = `?tag=${req.query.tag}&page=`;
            let tag = (req.query.tag as string).toLowerCase() as BotTags;
            let props = tagMap[tag];
            if (!props) {
                bots = bots.filter((bot) => commonFilter(bot, req));
            } else {
                icon = props.icon;
                title = res.__(props.title);
                subtitle = props.subtitle(res);
                bots = bots.filter((bot) => props.filter(bot, req));
            }
        }
        res.render("templates/bots/index", {
            title,
            subtitle,
            req,
            bots,
            icon: icon,
            pageParam,
            botsPgArr: bots.slice(
                15 * Number(req.query.page) - 15,
                15 * Number(req.query.page)
            ),
            page: req.query.page,
            pages: Math.ceil(bots.length / 15)
        });
    }
}

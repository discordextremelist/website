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

import { PathRoute } from "../../route.ts";
import type { Request, Response } from "express";
import * as discord from "../../../Util/Services/discord/index.ts";
import * as banned from "../../../Util/Services/access/banned.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as botCache from "../../../Util/Services/cache/botCaching.ts";
import * as serverCache from "../../../Util/Services/cache/serverCaching.ts";
import * as templateCache from "../../../Util/Services/cache/templateCaching.ts";
import * as userCache from "../../../Util/Services/cache/userCaching.ts";
import { renderStatus } from "../../../Util/Function/responses.ts";

export class GetUser extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id", [variables]);
    }

    async handle(req: Request, res: Response) {
        if (req.params.id === "@me") {
            if (!req.user) {
                if (req.session.logoutJustCont === true) {
                    req.session.logoutJust = false;
                    req.session.logoutJustCont = false;
                    return res.redirect("/");
                }

                return res.redirect("/auth/login");
            }

            req.params.id = req.user.id;
        }

        let delUser: delUser | null = await userCache.getUser(req.params.id);
        if (!delUser) {
            delUser = await global.db
                .collection<delUser>("users")
                .findOne({ _id: req.params.id });
            if (!delUser)
                return renderStatus(
                    req,
                    res,
                    404,
                    res.__("common.error.user.404")
                );
        }

        res.locals.premidPageInfo = res.__("premid.user", delUser.fullUsername);

        const bots = await botCache.getAllBots();

        const botsOwner: delBot[] = [];
        const botsEditor: delBot[] = [];
        const archivedBots: delBot[] = [];
        const hiddenBots: delBot[] = [];

        for (const bot of bots) {
            if (
                bot.status.archived === true &&
                bot.owner.id === req.params.id
            ) {
                archivedBots.push(bot);
            } else if (
                (bot.status.hidden || bot.status.modHidden) &&
                bot.owner.id === req.params.id
            ) {
                hiddenBots.push(bot);
            } else if (bot.owner.id === req.params.id) {
                botsOwner.push(bot);
            } else if (
                bot.editors.includes(req.params.id) &&
                !bot.status.archived
            ) {
                botsEditor.push(bot);
            }
        }

        const servers = await serverCache.getAllServers();

        const serversOwner: delServer[] = [];

        for (const server of servers) {
            if (req.params.id === server.owner.id) {
                serversOwner.push(server);
            }
        }

        const templates = await templateCache.getAllTemplates();

        const templatesOwner: delTemplate[] = [];

        for (const template of templates) {
            if (req.params.id === template.owner.id) {
                templatesOwner.push(template);
            }
        }

        res.locals.pageType.user = true;

        res.render("templates/users/profile", {
            title: res.__("page.users.profile.title", delUser.fullUsername),
            subtitle: delUser.profile.bio,
            userProfile: delUser,
            req,
            userStatus: await discord.getStatus(delUser._id),
            userProfileIsBanned: await banned.check(delUser._id),
            botsOwner,
            botsEditor,
            archivedBots,
            hiddenBots,
            serversOwner,
            templatesOwner
        });
    }
}

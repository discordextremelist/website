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

import { AuthedPathRoute } from "../../route.ts";
import type { Response } from "express";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";
import * as serverCache from "../../../Util/Services/serverCaching.ts";
import * as templateCache from "../../../Util/Services/templateCaching.ts";
import * as userCache from "../../../Util/Services/userCaching.ts";
import settings from "../../../../settings.json" with { type: "json" };
import { renderStatus } from "../../../Util/Function/main.ts";
import { logWebsiteAction } from "../../../Util/Function/websiteLog.ts";

export class GetAccountData extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/account/data", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: Response) {
        let dataRequestTimeout = false;

        // Checks if req.user.db.lastDataRequest is not null; if it is not, checks whether lastDataRequest occurred less than 24 hours ago. If so, returns true.
        if (
            req.user.db.lastDataRequest &&
            (Date.now() - req.user.db.lastDataRequest) / (1000 * 60 * 60) < 24
        )
            dataRequestTimeout = true;

        res.render("templates/users/data", {
            title: res.__("common.nav.me.data"),
            subtitle: res.__("common.nav.me.data.subtitle"),
            req,
            dataRequestTimeout
        });
    }
}

export class RequestAccountData extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/account/data/request", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: Response) {
        // Checks if req.user.db.lastDataRequest is not null; if it is not, checks whether lastDataRequest occurred less than 24 hours ago. If so, returns true.
        if (
            req.user.db.lastDataRequest &&
            (Date.now() - req.user.db.lastDataRequest) / (1000 * 60 * 60) < 24
        )
            return renderStatus(
                req,
                res,
                429,
                res.__("common.error.account.data.alreadyDownloaded")
            );

        // The variables middleware has already loaded this user's record.
        const userData = (await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.user.id }))!;

        const userBotsData: delBot[] = await global.db
            .collection<delBot>("bots")
            .find({ "owner.id": req.user.id })
            .toArray();

        const userServersData: delServer[] = await global.db
            .collection<delServer>("servers")
            .find({ "owner.id": req.user.id })
            .toArray();

        const userTemplateData: delTemplate[] = await global.db
            .collection<delTemplate>("templates")
            .find({ "owner.id": req.user.id })
            .toArray();

        // Leave out auth (the user's login tokens).
        const { auth: _auth, ...userExport } = userData;

        // Filter userBots.votes to not expose user ID's of persons who up/downvoted a bot an instead show number inside of the existing string[]
        for (const bot of userBotsData) {
            const positiveVotes = bot.votes.positive.length;
            const negativeVotes = bot.votes.negative.length;

            bot.votes.positive = [positiveVotes.toString()];
            bot.votes.negative = [negativeVotes.toString()];
        }

        // Leave out each bot's API token.
        const botsExport = userBotsData.map(({ token: _token, ...bot }) => bot);

        /*
        Updates 'lastDataRequest' in the database so that any future attempted requests are checked against this.
        If the next attempted request is less than 24 hours relative to this current time, it will be denied.
    */
        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    lastDataRequest: Date.now()
                }
            }
        );

        userCache.updateUser(req.user.id);

        res.setHeader(
            "Content-disposition",
            `attachment; filename="del_data_user_${userData._id}.json"`
        );
        res.send(
            JSON.stringify(
                {
                    user: userExport,
                    bots: botsExport,
                    servers: userServersData,
                    templates: userTemplateData
                },
                null,
                4
            )
        );
    }
}

export class DeleteOwnAccountData extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/account/data/delete", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: Response) {
        // Checks if the user's username is equal to the username they provided in the deletion form
        if (req.user.db.fullUsername !== req.body.typedUsername)
            return renderStatus(
                req,
                res,
                400,
                res.__(
                    "common.error.account.data.confirmationUsernameIncorrect"
                )
            );

        const userBotsData: delBot[] = await global.db
            .collection<delBot>("bots")
            .find({ "owner.id": req.user.id })
            .toArray();

        const userServersData: delServer[] = await global.db
            .collection<delServer>("servers")
            .find({ "owner.id": req.user.id })
            .toArray();

        const userTemplatesData: delTemplate[] = await global.db
            .collection<delTemplate>("templates")
            .find({ "owner.id": req.user.id })
            .toArray();

        // Loops through the user's bots, servers and templates and deletes them from the database.
        for (const bot of userBotsData) {
            await global.db.collection("bots").deleteOne({ _id: bot._id });

            await global.db.collection("audit").insertOne({
                type: "DELETE_BOT",
                executor: req.user.id,
                target: bot._id,
                date: Date.now(),
                reason: "Owner deleted their data and account."
            });

            await botCache.deleteBot(bot._id);

            await logWebsiteAction(
                req,
                settings.emoji.delete,
                "deleted bot",
                bot.name,
                bot._id
            );
        }

        for (const server of userServersData) {
            await global.db
                .collection("servers")
                .deleteOne({ _id: server._id });

            await global.db.collection("audit").insertOne({
                type: "DELETE_SERVER",
                executor: req.user.id,
                target: server._id,
                date: Date.now(),
                reason: "Owner deleted their data and account."
            });

            await serverCache.deleteServer(server._id);

            await logWebsiteAction(
                req,
                settings.emoji.delete,
                "deleted server",
                server.name,
                server._id
            );
        }

        for (const template of userTemplatesData) {
            await global.db
                .collection("templates")
                .deleteOne({ _id: template._id });

            await global.db.collection("audit").insertOne({
                type: "DELETE_TEMPLATE",
                executor: req.user.id,
                target: template._id,
                date: Date.now(),
                reason: "Owner deleted their data and account."
            });

            await templateCache.deleteTemplate(template._id);

            await logWebsiteAction(
                req,
                settings.emoji.delete,
                "deleted template",
                template.name,
                template._id
            );
        }

        // Deletes the user's account from the database and cache.
        await global.db.collection("users").deleteOne({ _id: req.user.id });

        await userCache.deleteUser(req.user.id);

        // Terminates the user's session.
        req.logout((err) => {
            if (err) {
                // Returns error page with error log if session termination encounters an error.
                return renderStatus(req, res, 500, err);
            }

            // Returns success status page if session terminates successfully.
            return res.status(200).render("status", {
                res,
                title: res.__("common.success"),
                subtitle: res.__("common.success.account.delete"),
                status: 200,
                type: "Success",
                req
            });
        });
    }
}

export class DeleteUserAccountData extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/account/data/:id/delete", [
            variables,
            permission.auth,
            permission.admin
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        if (!req.params.id) return res.sendStatus(400);
        let user = await userCache.getUser(req.params.id);
        if (user && user.fullUsername !== req.body.typedUsername)
            return renderStatus(
                req,
                res,
                400,
                res.__(
                    "common.error.account.data.confirmationUsernameIncorrect"
                )
            );
        const userBotsData: delBot[] = await global.db
            .collection<delBot>("bots")
            .find({ "owner.id": req.params.id })
            .toArray();
        const userServersData: delServer[] = await global.db
            .collection<delServer>("servers")
            .find({ "owner.id": req.params.id })
            .toArray();
        const userTemplatesData: delTemplate[] = await global.db
            .collection<delTemplate>("templates")
            .find({ "owner.id": req.params.id })
            .toArray();
        console.log(userBotsData, userServersData, userTemplatesData);

        // Loops through the user's bots, servers and templates and deletes them from the database.
        for (const bot of userBotsData) {
            await global.db.collection("bots").deleteOne({ _id: bot._id });

            await global.db.collection("audit").insertOne({
                type: "DELETE_BOT",
                executor: req.user.id,
                target: bot._id,
                date: Date.now(),
                reason: "Owner deleted their data and account."
            });

            await botCache.deleteBot(bot._id);

            await logWebsiteAction(
                req,
                settings.emoji.delete,
                "deleted bot",
                bot.name,
                bot._id
            );
        }

        for (const server of userServersData) {
            await global.db
                .collection("servers")
                .deleteOne({ _id: server._id });

            await global.db.collection("audit").insertOne({
                type: "DELETE_SERVER",
                executor: req.user.id,
                target: server._id,
                date: Date.now(),
                reason: "Owner deleted their data and account."
            });

            await serverCache.deleteServer(server._id);

            await logWebsiteAction(
                req,
                settings.emoji.delete,
                "deleted server",
                server.name,
                server._id
            );
        }

        for (const template of userTemplatesData) {
            await global.db
                .collection("templates")
                .deleteOne({ _id: template._id });

            await global.db.collection("audit").insertOne({
                type: "DELETE_TEMPLATE",
                executor: req.user.id,
                target: template._id,
                date: Date.now(),
                reason: "Owner deleted their data and account."
            });

            await templateCache.deleteTemplate(template._id);

            await logWebsiteAction(
                req,
                settings.emoji.delete,
                "deleted template",
                template.name,
                template._id
            );
        }

        // Deletes the user's account from the database and cache.
        await global.db.collection("users").deleteOne({ _id: req.params.id });
        await userCache.deleteUser(req.params.id);
        return res.redirect("/");
    }
}

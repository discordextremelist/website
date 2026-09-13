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
import * as userCache from "../../../Util/Services/cache/userCaching.ts";
import { renderStatus } from "../../../Util/Function/responses.ts";
import {
    deleteListings,
    ownedListings
} from "../../../Util/Function/ownedListings.ts";

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

        const {
            bots: userBotsData,
            servers: userServersData,
            templates: userTemplateData
        } = await ownedListings(req.user.id);

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

        // Deletes the user's bots, servers and templates.
        await deleteListings(req, await ownedListings(req.user.id));

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
        const listings = await ownedListings(req.params.id);
        console.log(listings.bots, listings.servers, listings.templates);

        // Deletes the user's bots, servers and templates.
        await deleteListings(req, listings);

        // Deletes the user's account from the database and cache.
        await global.db.collection("users").deleteOne({ _id: req.params.id });
        await userCache.deleteUser(req.params.id);
        return res.redirect("/");
    }
}

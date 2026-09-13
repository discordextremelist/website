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
import settings from "../../../../settings.json" with { type: "json" };
import * as permission from "../../../Util/Middleware/permissions.ts";
import { parseScopes } from "../../../Util/Function/listing.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as discord from "../../../Util/Services/discord.ts";

export class BotQueue extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/bot_queue", [variables, permission.mod]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const bots = await global.db
            .collection<delQueueBot>("bots")
            .aggregate([
                {
                    $lookup: {
                        from: "tickets",
                        localField: "_id",
                        foreignField: "ids.bot",
                        as: "tickets"
                    }
                },
                {
                    $addFields: {
                        "status.pendingTicket": {
                            $gt: [
                                {
                                    $size: {
                                        $filter: {
                                            input: "$tickets",
                                            as: "ticket",
                                            cond: {
                                                $ne: ["$$ticket.status", 2]
                                            } // Exclude closed tickets
                                        }
                                    }
                                },
                                0
                            ]
                        }
                    }
                },
                {
                    $project: {
                        tickets: 0 // Exclude ticket data to reduce payload size
                    }
                },
                {
                    $sort: { "date.submitted": 1 }
                }
            ])
            .toArray();

        res.locals.premidPageInfo = res.__("premid.staff.queue");

        res.render("templates/staff/queue", {
            title: res.__("page.staff.queue"),
            subtitle: res.__("page.staff.queue.subtitle"),
            req,
            bots: bots.filter(
                ({ status }) => !status.approved && !status.archived
            ),
            mainServer: settings.guild.main,
            staffServer: settings.guild.staff,
            botServer: settings.guild.bot,
            parseScopes: parseScopes
        });
    }
}

export class ServerQueue extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/server_queue", [variables, permission.mod]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const servers: delServer[] = await global.db
            .collection<delServer>("servers")
            .find()
            .sort({ "date.submitted": 1 })
            .allowDiskUse()
            .toArray();

        res.locals.premidPageInfo = res.__("premid.staff.server_queue");

        res.render("templates/staff/server_queue", {
            title: res.__("page.staff.server_queue"),
            subtitle: res.__("page.staff.server_queue.subtitle"),
            req,
            servers: servers.filter(
                ({ status }) => status && status.reviewRequired
            )
        });
    }
}

export class InviteQueue extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/invite_queue", [variables, permission.mod]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const bots: delBot[] = (
            await global.db
                .collection<delBot>("bots")
                .find({
                    $and: [
                        {
                            "status.archived": false,
                            "status.approved": true,
                            "status.siteBot": false
                        }
                    ]
                })
                .sort({ "date.submitted": 1 })
                .allowDiskUse()
                .toArray()
        ).map((bot) => {
            if (req.query.migrate === "1") {
                bot.inServer = discord.guilds.bot.members.cache.has(bot._id);
            } else {
                bot.inServer =
                    discord.guilds.bot.members.cache.has(bot._id) ||
                    discord.guilds.main.members.cache.has(bot._id);
            }
            return bot;
        });

        res.locals.premidPageInfo = res.__("premid.staff.invite_queue");

        res.render("templates/staff/invite_queue", {
            title: res.__("page.staff.invite_queue"),
            subtitle: res.__("page.staff.invite_queue.subtitle"),
            req,
            bots: bots.filter(
                ({ inServer, scopes }) => !inServer && (!scopes || scopes.bot)
            ),
            mainServer: settings.guild.main,
            staffServer: settings.guild.staff,
            botServer: settings.guild.bot
        });
    }
}

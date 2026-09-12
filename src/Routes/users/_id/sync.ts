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
import type { APIUser, DiscordAPIError } from "discord.js";
import { Routes } from "discord.js";
import * as discord from "../../../Util/Services/discord.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as userCache from "../../../Util/Services/userCaching.ts";
import { renderStatus } from "../../../Util/Function/main.ts";

export class SyncUser extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/sync", [variables, permission.auth]);
    }

    async handle(req: Request, res: Response) {
        if (req.params.id === "@me") {
            req.params.id = req.user.id;
        }

        const userProfile: delUser = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.params.id });
        if (!userProfile)
            return renderStatus(req, res, 404, res.__("common.error.user.404"));

        await discord.bot.rest
            .get(Routes.user(req.params.id))
            .then(async (user: APIUser) => {
                await global.db.collection("users").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            name: user.username,
                            flags: user.public_flags,
                            avatar: {
                                hash: user.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.params.id}/${user.avatar}`
                            }
                        } satisfies Partial<delUser>
                    }
                );

                await global.db.collection("audit").insertOne({
                    type: "SYNC_USER",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        old: {
                            name: userProfile.name,
                            flags: userProfile.flags,
                            avatar: {
                                hash: userProfile.avatar.hash,
                                url: userProfile.avatar.url
                            }
                        } satisfies Partial<delUser>,
                        new: {
                            name: user.username,
                            flags: user.public_flags,
                            avatar: {
                                hash: user.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.params.id}/${user.avatar}`
                            }
                        } satisfies Partial<delUser>
                    }
                });
                await userCache.updateUser(req.params.id);

                res.redirect(`/users/${req.params.id}`);
            })
            .catch((error: DiscordAPIError) => {
                return renderStatus(
                    req,
                    res,
                    400,
                    `${error.name}: ${error.message} | ${error.code} ${error.method} ${error.url}`
                );
            });
    }
}

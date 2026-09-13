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

import { AuthedPathRoute } from "../route.ts";
import type { Response } from "express";
import type { APIUser, Snowflake } from "discord.js";
import { Routes } from "discord.js";
import * as permission from "../../Util/Middleware/permissions.ts";
import { grabFullUser } from "../../Util/Function/common/format.ts";
import { newUserRecord } from "../../Util/Function/users/userRecords.ts";
import { variables } from "../../Util/Middleware/variables.ts";
import * as discord from "../../Util/Services/discord/index.ts";

export class MaskUser extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/mask/:id", [
            variables,
            permission.admin,
            permission.adminTokenInProd
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        if (req.params.id === req.user.id) return res.redirect("/staff");

        let user: delUser | null = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.params.id });

        await discord
            .restGet<APIUser>(Routes.user(req.params.id))
            .then(async (discordUser: APIUser) => {
                if (!user) {
                    // Someone who has never logged in: no OAuth token or
                    // flags yet, so the record isn't a full delUser.
                    await global.db.collection<any>("users").insertOne(
                        newUserRecord({
                            _id: req.params.id,
                            auth: {
                                accessToken: "",
                                expires: 0,
                                refreshToken: "",
                                scopes: []
                            },
                            name: discordUser.username,
                            discrim: discordUser.discriminator,
                            fullUsername: grabFullUser(discordUser),
                            locale: "",
                            flags: undefined,
                            avatar: {
                                hash: discordUser.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.params.id}/${discordUser.avatar}`
                            }
                        })
                    );
                } else {
                    await global.db.collection("users").updateOne(
                        { _id: req.params.id },
                        {
                            $set: {
                                name: discordUser.username,
                                discrim: discordUser.discriminator,
                                fullUsername: grabFullUser(discordUser),
                                avatar: {
                                    hash: discordUser.avatar,
                                    url: `https://cdn.discordapp.com/avatars/${req.params.id}/${discordUser.avatar}`
                                }
                            }
                        }
                    );
                }

                user = await global.db
                    .collection<delUser>("users")
                    .findOne({ _id: req.params.id });
                if (!req.user.impersonator) req.user.impersonator = req.user.id;
                req.user.id = req.params.id as Snowflake;
                // The record was inserted or updated just above.
                req.user.db = user!;
                res.redirect("/");
            })
            .catch(() => {
                return res.redirect("/staff");
            });
    }
}

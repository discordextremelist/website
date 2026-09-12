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
import type { APIUser, Snowflake } from "discord.js";
import { Routes } from "discord.js";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as functions from "../../../Util/Function/main.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as tokenManager from "../../../Util/Services/adminTokenManager.ts";
import * as discord from "../../../Util/Services/discord.ts";

export class MaskUser extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/mask/:id", [variables, permission.admin]);
    }

    async handle(req: AuthedRequest, res: Response) {
        if (req.params.id === req.user.id) return res.redirect("/staff");

        if (global.env_prod) {
            if (!req.query.token) return res.json({});
            const tokenCheck = await tokenManager.verifyToken(
                req.user.id,
                req.query.token as string
            );
            if (tokenCheck === false) return res.json({});
        }

        let user: delUser | null = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.params.id });

        await discord
            .restGet<APIUser>(Routes.user(req.params.id))
            .then(async (discordUser: APIUser) => {
                if (!user) {
                    await global.db.collection<any>("users").insertOne({
                        auth: {
                            accessToken: "",
                            expires: 0,
                            refreshToken: "",
                            scopes: []
                        },
                        flags: undefined,
                        _id: req.params.id,
                        token: "",
                        name: discordUser.username,
                        discrim: discordUser.discriminator,
                        fullUsername: functions.grabFullUser(discordUser),
                        locale: "",
                        avatar: {
                            hash: discordUser.avatar,
                            url: `https://cdn.discordapp.com/avatars/${req.params.id}/${discordUser.avatar}`
                        },
                        preferences: {
                            customGlobalCss: "",
                            defaultColour: "#BA2EFF",
                            defaultForegroundColour: "#ffffff",
                            enableGames: true,
                            experiments: false
                        },
                        profile: {
                            bio: "",
                            css: "",
                            links: {
                                website: "",
                                github: "",
                                gitlab: "",
                                twitter: "",
                                instagram: "",
                                snapchat: ""
                            }
                        },
                        game: {
                            snakes: {
                                maxScore: 0
                            }
                        },
                        rank: {
                            admin: false,
                            assistant: false,
                            mod: false,
                            verified: false,
                            tester: false,
                            translator: false,
                            covid: false
                        },
                        staffTracking: {
                            details: {
                                away: {
                                    status: false,
                                    message: ""
                                },
                                standing: "Unmeasured",
                                country: "",
                                timezone: "",
                                managementNotes: "",
                                languages: []
                            },
                            lastLogin: 0,
                            lastAccessed: {
                                time: 0,
                                page: ""
                            },
                            punishments: {
                                strikes: [],
                                warnings: []
                            },
                            handledBots: {
                                allTime: {
                                    total: 0,
                                    approved: 0,
                                    unapprove: 0,
                                    declined: 0,
                                    remove: 0
                                },
                                prevWeek: {
                                    total: 0,
                                    approved: 0,
                                    unapprove: 0,
                                    declined: 0,
                                    remove: 0
                                },
                                thisWeek: {
                                    total: 0,
                                    approved: 0,
                                    unapprove: 0,
                                    declined: 0,
                                    remove: 0
                                }
                            },
                            handledServers: {
                                allTime: {
                                    total: 0,
                                    approved: 0,
                                    declined: 0,
                                    remove: 0
                                },
                                prevWeek: {
                                    total: 0,
                                    approved: 0,
                                    declined: 0,
                                    remove: 0
                                },
                                thisWeek: {
                                    total: 0,
                                    approved: 0,
                                    declined: 0,
                                    remove: 0
                                }
                            },
                            handledTemplates: {
                                allTime: {
                                    total: 0,
                                    approved: 0,
                                    declined: 0,
                                    remove: 0
                                },
                                prevWeek: {
                                    total: 0,
                                    approved: 0,
                                    declined: 0,
                                    remove: 0
                                },
                                thisWeek: {
                                    total: 0,
                                    approved: 0,
                                    declined: 0,
                                    remove: 0
                                }
                            }
                        }
                    });
                } else {
                    await global.db.collection("users").updateOne(
                        { _id: req.params.id },
                        {
                            $set: {
                                name: discordUser.username,
                                discrim: discordUser.discriminator,
                                fullUsername:
                                    functions.grabFullUser(discordUser),
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

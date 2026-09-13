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
import { variables } from "../../Util/Middleware/variables.ts";
import * as permission from "../../Util/Middleware/permissions.ts";
import { getForeground } from "../../Util/Function/common/format.ts";
import * as userCache from "../../Util/Services/cache/userCaching.ts";
import { themes } from "../../../@types/enums.ts";
import entities from "html-entities";
import { recordAudit } from "../../Util/Function/staff/recordAudit.ts";

export class GetPreferences extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/account/preferences", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: Response) {
        res.locals.premidPageInfo = res.__("premid.preferences");

        res.render("templates/users/accountPreferences", {
            title: res.__("common.nav.me.preferences"),
            subtitle: res.__("common.nav.me.preferences.subtitle"),
            customGlobalCssDB: entities.decode(
                req.user.db.preferences.customGlobalCss
            ),
            req
        });
    }
}

export class PostPreferences extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/account/preferences", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: Response) {
        let gamePreferences: boolean,
            experiments: boolean,
            theme: number,
            hideNSFW: boolean;

        // Refer to docs/THEME.md in the root directory of this project.
        switch (req.body.theme) {
            case "dark":
                theme = themes.dark;
                break;
            case "light":
                theme = themes.light;
                break;
            default:
                theme = themes.black;
                break;
        }

        gamePreferences = req.body.noGames !== "on";
        experiments = req.body.experiments === "on";
        hideNSFW = req.body.hideNSFW === "on";

        const foreground = getForeground(req.body.iconColour);

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    preferences: {
                        customGlobalCss: req.body.customCss,
                        defaultColour: req.body.iconColour,
                        defaultForegroundColour: foreground,
                        enableGames: gamePreferences,
                        experiments: experiments,
                        theme: theme,
                        hideNSFW: hideNSFW
                    }
                }
            }
        );

        await recordAudit({
            type: "MODIFY_PREFERENCES",
            executor: req.user.id,
            target: req.user.id,
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    preferences: {
                        customGlobalCss:
                            req.user.db.preferences.customGlobalCss,
                        defaultColour: req.user.db.preferences.defaultColour,
                        defaultForegroundColour:
                            req.user.db.preferences.defaultForegroundColour,
                        enableGames: req.user.db.preferences.enableGames,
                        experiments: req.user.db.preferences.experiments,
                        theme: theme,
                        hideNSFW: req.user.db.preferences.hideNSFW
                    }
                },
                new: {
                    preferences: {
                        customGlobalCss: req.body.customCss,
                        defaultColour: req.body.iconColour,
                        defaultForegroundColour: foreground,
                        enableGames: gamePreferences,
                        experiments: experiments,
                        theme: theme,
                        hideNSFW: hideNSFW
                    }
                }
            }
        });

        await userCache.updateUser(req.user.id);

        res.redirect("/users/@me");
    }
}

export class ResetPreferences extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/account/preferences/reset", [
            variables,
            permission.auth
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    preferences: {
                        customGlobalCss: "",
                        defaultColour: "#BA2EFF",
                        defaultForegroundColour: "#ffffff",
                        enableGames: true,
                        experiments: false,
                        theme: 0
                    }
                }
            }
        );
        await userCache.updateUser(req.user.id);

        res.redirect("/users/@me");
    }
}

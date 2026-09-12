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

import { AuthedPathRoute, PathRoute } from "../../route.ts";
import type { Request, Response } from "express";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as userCache from "../../../Util/Services/userCaching.ts";

export class GetSnake extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/game/snake", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: Response) {
        res.locals.premidPageInfo = res.__("premid.snake");

        res.render("templates/users/snake", {
            title: res.__("common.nav.me.playSnake"),
            subtitle: res.__("common.nav.me.playSnake.subtitle"),
            req,
            res
        });
    }
}

export class GetSnakeLeaderboard extends PathRoute<"get"> {
    constructor() {
        super("get", "/game/snake/leaderboard", [variables]);
    }

    async handle(req: Request, res: Response) {
        res.locals.premidPageInfo = res.__("premid.snake.lb");

        const users = await userCache.getAllUsers();

        res.render("templates/users/snakeLB", {
            title: res.__("common.nav.me.snakeLB"),
            subtitle: res.__("common.nav.me.snakeLB.subtitle", "25"),
            req,
            users: users
                .sort((a, b) => b.game.snakes.maxScore - a.game.snakes.maxScore)
                .splice(0, 25)
        });
    }
}

export class GetProfileSnakes extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/profile/game/snakes", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const user: delUser = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.user.id });

        res.status(200).json({
            error: false,
            status: 200,
            result: user.game.snakes.maxScore
        });
    }
}

export class PostProfileSnakes extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/profile/game/snakes", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: Response) {
        if (req.body.score <= req.user.db.game.snakes.maxScore)
            return res.status(202).json({
                error: false,
                status: 202,
                message:
                    "Posted score is lower or equal to the user's current high score - no changes were made"
            });

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $inc: {
                    "game.snakes.maxScore": 1
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "GAME_HIGHSCORE_UPDATE",
            executor: req.user.id,
            target: req.user.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    game: {
                        snakes: {
                            maxScore: req.user.db.game.snakes.maxScore
                        }
                    }
                },
                new: {
                    game: {
                        snakes: {
                            maxScore: req.user.db.game.snakes.maxScore + 1
                        }
                    }
                }
            }
        });

        await userCache.updateUser(req.user.id);

        res.status(200).json({
            error: false,
            status: 200,
            message: "Updated high score"
        });
    }
}

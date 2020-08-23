/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020 Cairo Mitchell-Acason, John Burke, Advaith Jagathesan

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

import express from "express";
import { Request, Response } from "express";
import { APIUser } from "discord-api-types"
import { delBot, delServer, delTemplate, delUser } from "../../@types/del"

import * as discord from "../Util/Services/discord";
import * as banned from "../Util/Services/banned";
import { variables } from "../Util/Function/variables";
import * as permission from "../Util/Function/permissions";
import * as functions from "../Util/Function/main";
import * as botCache from "../Util/Services/botCaching";
import * as serverCache from "../Util/Services/serverCaching";
import * as templateCache from "../Util/Services/templateCaching";
import * as userCache from "../Util/Services/userCaching";
import * as tokenManager from "../Util/Services/adminTokenManager";
import * as fetch from "node-fetch";
import { Response as fetchRes } from "../../@types/fetch";
import * as settings from "../../settings.json";

const Entities = require("html-entities").XmlEntities;
const entities = new Entities();
const router = express.Router();

router.get("/:id", variables, async (req: Request, res: Response, next) => {
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

    let delUser: delUser | undefined = await userCache.getUser(req.params.id);
    if (!delUser) {
        delUser = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });
        if (!delUser)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });
    }

    res.locals.premidPageInfo = res.__("premid.user", delUser.fullUsername);

    const bots = await botCache.getAllBots();

    const botsOwner: delBot[] = [];
    const botsEditor: delBot[] = [];
    const archivedBots: delBot[] = [];

    for (const bot of bots) {
        if (bot.status.archived === true && bot.owner.id === req.params.id) {
            archivedBots.push(bot);
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
        serversOwner,
        templatesOwner
    });
});

router.get(
    "/:id/rank",
    variables,
    permission.auth,
    permission.assistant,
    async (req: Request, res: Response, next) => {
        const targetUser: delUser = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        if (!targetUser)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__(
            "premid.user.modifyRank",
            targetUser.fullUsername
        );

        if (
            targetUser.rank.assistant === true &&
            req.user.db.rank.admin === false &&
            req.user.db.rank.assistant === true
        )
            return res.status(403).render("status", {
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__(
                    "page.users.modifyRank.assistantHierachyBlock.0"
                ),
                req,
                type: "Error"
            });

        res.render("templates/users/staffActions/modifyRank", {
            title: res.__("Modify Rank"),
            subtitle: res.__("Modifiying rank of %s", targetUser.fullUsername),
            user: req.user,
            req: req,
            targetUser: targetUser
        });
    }
);

router.post(
    "/:id/rank",
    variables,
    permission.auth,
    permission.assistant,
    async (req: Request, res: Response, next) => {
        const targetUser: delUser = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        if (!targetUser)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            targetUser.rank.assistant === true &&
            req.user.db.rank.admin === false &&
            req.user.db.rank.assistant === true
        )
            return res.status(403).render("status", {
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__(
                    "page.users.modifyRank.assistantHierachyBlock.0"
                ),
                req,
                type: "Error"
            });

        let premium = false;
        let tester = false;
        let translator = false;
        let covid = false;
        let mod = false;
        let assistant = false;
        let admin = false;

        if (req.body.tester === "on") tester = true;
        if (req.body.translator === "on") translator = true;
        if (req.body.premium === "on") premium = true;
        if (req.body.covid === "on") covid = true;

        if (req.body.rank === "mod") mod = true;

        if (
            (req.user.db.rank.admin === false &&
                req.body.rank === "assistant") ||
            (req.user.db.rank.admin === false && req.body.rank === "admin")
        ) {
            return res.status(403).render("status", {
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__(
                    "page.users.modifyRank.assistantHierachyBlock.1"
                ),
                req,
                type: "Error"
            });
        } else {
            if (req.body.rank === "assistant") {
                mod = true;
                assistant = true;
            } else if (req.body.rank === "admin") {
                mod = true;
                assistant = true;
                admin = true;
            }
        }

        await global.db.collection("users").updateOne(
            { _id: targetUser._id },
            {
                $set: {
                    rank: {
                        admin: admin,
                        assistant: assistant,
                        mod: mod,
                        translator: translator,
                        tester: tester,
                        premium: premium,
                        covid: covid
                    }
                }
            }
        );

        await userCache.updateUser(targetUser._id);

        await global.db.collection("audit").insertOne({
            type: "MODIFY_RANK",
            executor: req.user.id,
            target: targetUser._id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    rank: {
                        admin: targetUser.rank.admin,
                        assistant: targetUser.rank.assistant,
                        mod: targetUser.rank.mod,
                        translator: targetUser.rank.translator,
                        tester: targetUser.rank.tester,
                        premium: targetUser.rank.premium,
                        covid: targetUser.rank.covid
                    }
                },
                new: {
                    rank: {
                        admin: admin,
                        assistant: assistant,
                        mod: mod,
                        translator: translator,
                        tester: tester,
                        premium: premium,
                        covid: covid
                    }
                }
            }
        });

        res.redirect(`/users/${targetUser._id}`);
    }
);

router.get(
    "/:id/src",
    variables,
    permission.auth,
    permission.admin,
    async (req: Request, res: Response, next) => {
        if (req.params.id === "@me") {
            if (!req.user) return res.redirect("/auth/login");
            req.params.id = req.user.id;
        }

        if (!req.query.token) return res.json({});
        const tokenCheck = await tokenManager.verifyToken(
            req.user.id,
            req.query.token as string
        );
        if (tokenCheck === false) return res.json({});

        const cache: delUser | undefined = await userCache.getUser(
            req.params.id
        );

        const db: delUser | undefined = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        return res.json({ cache: cache, db: db });
    }
);

router.get(
    "/@me/src/session",
    variables,
    permission.auth,
    permission.admin,
    async (req: Request, res: Response, next) => {
        if (!req.query.token) return res.json({});
        const tokenCheck = await tokenManager.verifyToken(
            req.user.id,
            req.query.token as string
        );
        if (tokenCheck === false) return res.json({});

        return res.json(req.user);
    }
);

router.get("/profile/:id", (req: Request, res: Response, next) => {
    res.redirect("/" + req.params.id);
});

router.get(
    "/profile/:id/edit",
    variables,
    permission.auth,
    async (req: Request, res: Response, next) => {
        if (req.params.id === "@me") {
            req.params.id = req.user.id;
        }

        const userProfile: delUser = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });
        if (!userProfile)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            userProfile._id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__("common.error.user.perms.edit"),
                req: req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__(
            "premid.user.edit",
            userProfile.fullUsername
        );

        res.render("templates/users/editProfile", {
            title: res.__("page.users.edit.title"),
            subtitle: res.__(
                "page.users.edit.subtitle",
                req.user.db.fullUsername
            ),
            req,
            userProfile: userProfile
        });
    }
);

router.post(
    "/profile/:id/edit",
    variables,
    permission.auth,
    async (req: Request, res: Response, next) => {
        if (req.params.id === "@me") {
            req.params.id = req.user.id;
        }

        const userProfile: delUser = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });
        if (!userProfile)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req: req
            });

        if (
            userProfile._id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__("common.error.user.perms.edit"),
                req: req,
                type: "Error"
            });

        let customCss: string = "";
        if (
            userProfile.rank.premium ||
            userProfile.rank.mod ||
            userProfile.rank.assistant ||
            userProfile.rank.admin
        ) {
            customCss = req.body.profileCss;
        }

        await global.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    profile: {
                        bio: req.body.bio,
                        css: customCss,
                        links: {
                            website: req.body.website,
                            github: req.body.github,
                            gitlab: req.body.gitlab,
                            twitter: req.body.twitter,
                            instagram: req.body.instagram,
                            snapchat: req.body.snapchat
                        }
                    }
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "MODIFY_PROFILE",
            executor: req.user.id,
            target: userProfile._id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    bio: userProfile.profile.bio,
                    css: userProfile.profile.css,
                    links: {
                        website: userProfile.profile.links.website,
                        github: userProfile.profile.links.github,
                        gitlab: userProfile.profile.links.gitlab,
                        twitter: userProfile.profile.links.twitter,
                        instagram: userProfile.profile.links.instagram,
                        snapchat: userProfile.profile.links.snapchat
                    }
                },
                new: {
                    bio: req.body.bio,
                    css: customCss,
                    links: {
                        website: req.body.website,
                        github: req.body.github,
                        gitlab: req.body.gitlab,
                        twitter: req.body.twitter,
                        instagram: req.body.instagram,
                        snapchat: req.body.snapchat
                    }
                }
            }
        });
        await userCache.updateUser(req.params.id);

        res.redirect(`/users/${req.params.id}`);
    }
);

router.get(
    "/:id/sync",
    variables,
    permission.auth,
    async (req: Request, res: Response, next) => {
        if (req.params.id === "@me") {
            req.params.id = req.user.id;
        }

        const userProfile: delUser = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });
        if (!userProfile)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req: req
            });

        await fetch(`https://discord.com/api/v6/users/${req.params.id}`, {
            method: "GET",
            headers: { Authorization: `Bot ${settings.secrets.discord.token}` }
        })
            .then(async (fetchRes: fetchRes) => {
                const user = await fetchRes.json() as APIUser
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
                        } as delUser
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
                        },
                        new: {
                            name: user.username,
                            flags: user.public_flags,
                            avatar: {
                                hash: user.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.params.id}/${user.avatar}`
                            }
                        }
                    }
                });
                await userCache.updateUser(req.params.id);
            })
            .catch((_) => {
                return res.status(502).json({
                    error: true,
                    status: 502,
                    errors: [res.__("common.error.dapiFail")]
                });
            });

        res.redirect(`/users/${req.params.id}`);
    }
);

router.get(
    "/game/snake",
    variables,
    permission.auth,
    async (req: Request, res: Response, next) => {
        res.locals.premidPageInfo = res.__("premid.snake");

        res.render("templates/users/snake", {
            title: res.__("common.nav.me.playSnake"),
            subtitle: res.__("common.nav.me.playSnake.subtitle"),
            req
        });
    }
);

router.get(
    "/game/snake/leaderboard",
    variables,
    async (req: Request, res: Response, next) => {
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
);

router.get(
    "/profile/game/snakes",
    variables,
    permission.auth,
    async (req: Request, res: Response, next) => {
        const user: delUser = await global.db
            .collection("users")
            .findOne({ _id: req.user.id });

        res.status(200).json({
            error: false,
            status: 200,
            result: user.game.snakes.maxScore
        });
    }
);

router.post(
    "/profile/game/snakes",
    variables,
    permission.auth,
    async (req: Request, res: Response, next) => {
        if (req.body.score <= req.user.db.game.snakes.maxScore)
            return res.status(202).json({
                error: false,
                status: 202,
                message:
                    "Posted score is lower or equal to the user's current high score - no changes were made"
            });

        const user: delUser = await global.db
            .collection("users")
            .findOne({ _id: req.user.id });
        const score = user.game.snakes.maxScore + 1;

        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    game: {
                        snakes: {
                            maxScore: score
                        }
                    }
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
                            maxScore: score
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
);

router.get(
    "/account/preferences",
    variables,
    permission.auth,
    async (req: Request, res: Response, next) => {
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
);

router.post(
    "/account/preferences",
    variables,
    permission.auth,
    async (req: Request, res: Response, next) => {
        let gamePreferences: boolean, experiments: boolean, theme: number;

        // Refer to docs/THEME.md in the root directory of this project.
        switch (req.body.theme) {
            case "black":
                theme = 0;
                break;
            case "dark":
                theme = 1;
                break;
            case "light":
                theme = 2;
                break;
            default:
                theme = 0;
                break;
        }

        if (req.body.noGames === "on") {
            gamePreferences = false;
        } else {
            gamePreferences = true;
        }

        if (req.body.experiments === "on") {
            experiments = true;
        } else {
            experiments = false;
        }

        const foreground = functions.getForeground(req.body.iconColour);

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
                        theme: theme
                    }
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "MODIFY_PREFERENCES",
            executor: req.user.id,
            target: req.user.id,
            date: Date.now(),
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
                        theme: theme
                    }
                },
                new: {
                    preferences: {
                        customGlobalCss: req.body.customCss,
                        defaultColour: req.body.iconColour,
                        defaultForegroundColour: foreground,
                        enableGames: gamePreferences,
                        experiments: experiments,
                        theme: theme
                    }
                }
            }
        });

        await userCache.updateUser(req.user.id);

        res.redirect("/users/@me");
    }
);

router.get(
    "/account/preferences/reset",
    variables,
    permission.auth,
    async (req: Request, res: Response, next) => {
        await global.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    preferences: {
                        customGlobalCss: "",
                        defaultColour: "#b114ff",
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
);

module.exports = router;

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

const express = require("express");
const router = express.Router();

const discord = require("../Util/Services/discord.js");
const banned = require("../Util/Services/banned.js");
const variables = require("../Util/Function/variables.js");
const permission = require("../Util/Function/permissions.js");
const functions = require("../Util/Function/main.js");

const botCache = require("../Util/Services/botCaching.js");
const serverCache = require("../Util/Services/serverCaching.js");
const templateCache = require("../Util/Services/templateCaching.js");
const userCache = require("../Util/Services/userCaching.js");

router.get("/:id", variables, async (req, res, next) => {
    if (req.params.id === "@me") {
        if (!req.user) return res.redirect("/auth/login");
        req.params.id = req.user.id;
    }

    let dbUser = await userCache.getUser(req.params.id);
    if (!dbUser) {
        dbUser = await req.app.db
            .collection("users")
            .findOne({ _id: req.params.id });
        if (!dbUser)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });
    }

    res.locals.premidPageInfo = res.__("premid.user", dbUser.fullUsername);

    const bots = await botCache.getAllBots();

    const botsOwner = [];
    const botsEditor = [];
    const archivedBots = [];

    for (var n = 0; n < bots.length; ++n) {
        const bot = bots[n];

        if (bot.status.archived === true && bot.owner.id === req.params.id) {
            archivedBots.push(bot);
        } else if (bot.owner.id === req.params.id) {
            botsOwner.push(bot);
        } else if (bot.editors.includes(req.params.id)) {
            botsEditor.push(bot);
        }
    }

    const servers = await serverCache.getAllServers();

    const serversOwner = [];

    for (var n = 0; n < servers.length; ++n) {
        const server = servers[n];

        if (req.params.id === server.owner.id) {
            serversOwner.push(server);
        }
    }

    const templates = await templateCache.getAllTemplates();

    const templatesOwner = [];

    for (var n = 0; n < templates.length; ++n) {
        const template = templates[n];

        if (req.params.id === template.owner.id) {
            templatesOwner.push(template);
        }
    }

    res.render("templates/users/profile", {
        title: res.__("page.users.profile.title", dbUser.fullUsername),
        subtitle: dbUser.profile.bio,
        userProfile: dbUser,
        req,
        userStatus: await discord.getStatus(dbUser._id),
        userProfileIsBanned: await banned.check(dbUser._id),
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
    async (req, res, next) => {
        const targetUser = await req.app.db
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
    async (req, res, next) => {
        const targetUser = await req.app.db
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

        await req.app.db.collection("users").updateOne(
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

        await req.app.db.collection("audit").insertOne({
            type: "MODIFY_RANK",
            executor: req.user.id,
            target: targetUser.id,
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

router.get("/profile/:id", (req, res, next) => {
    res.redirect("/" + req.params.id);
});

router.get(
    "/profile/:id/edit",
    variables,
    permission.auth,
    async (req, res, next) => {
        if (req.params.id === "@me") {
            req.params.id = req.user.id;
        }

        const userProfile = await req.app.db
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
    async (req, res, next) => {
        if (req.params.id === "@me") {
            req.params.id = req.user.id;
        }

        const userProfile = await req.app.db
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

        let customCss;
        if (userProfile.rank.premium) {
            customCss = req.body.profileCss;
        } else {
            customCss = "";
        }

        await req.app.db.collection("users").updateOne(
            { _id: req.user.id },
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

        await req.app.db.collection("audit").insertOne({
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

        res.redirect("/users/@me");
    }
);

router.get(
    "/game/snake",
    variables,
    permission.auth,
    async (req, res, next) => {
        res.render("templates/users/snake", {
            title: res.__("common.nav.me.playSnake"),
            subtitle: res.__("common.nav.me.playSnake.subtitle"),
            req
        });
    }
);

router.get(
    "/profile/game/snakes",
    variables,
    permission.auth,
    async (req, res, next) => {
        const user = await req.app.db
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
    async (req, res, next) => {
        if (req.body.score <= req.user.db.game.snakes.maxScore)
            return res.status(202).json({
                error: false,
                status: 202,
                message:
                    "Posted score is lower or equal to the user's current high score - no changes were made"
            });

        const user = await req.app.db
            .collection("users")
            .findOne({ _id: req.user.id });
        const score = user.game.snakes.maxScore + 1;

        await req.app.db.collection("users").updateOne(
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

        await req.app.db.collection("audit").insertOne({
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
    async (req, res, next) => {
        res.locals.premidPageInfo = res.__("premid.preferences");

        res.render("templates/users/accountPreferences", {
            title: res.__("common.nav.me.preferences"),
            subtitle: res.__("common.nav.me.preferences.subtitle"),
            req
        });
    }
);

router.post(
    "/account/preferences",
    variables,
    permission.auth,
    async (req, res, next) => {
        let gamePreferences, experiments;

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
        console.log(req.body.customCss);

        await req.app.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    preferences: {
                        customGlobalCss: req.body.customCss,
                        defaultColour: req.body.iconColour,
                        defaultForegroundColour: foreground,
                        enableGames: gamePreferences,
                        experiments: experiments
                    }
                }
            }
        );

        await req.app.db.collection("audit").insertOne({
            type: "MODIFY_PREFERENCES",
            executor: req.user.id,
            target: req.user.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    preferences: {
                        customGlobalCss: req.user.db.preferences.customCss,
                        defaultColour: req.user.db.preferences.defaultColour,
                        defaultForegroundColour:
                            req.user.db.preferences.defaultForegroundColour,
                        enableGames: req.user.db.preferences.enableGames,
                        experiments: req.user.db.preferences.experiments
                    }
                },
                new: {
                    preferences: {
                        customGlobalCss: req.body.customCss,
                        defaultColour: req.body.iconColour,
                        defaultForegroundColour: foreground,
                        enableGames: gamePreferences,
                        experiments: experiments
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
    async (req, res, next) => {
        await req.app.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    preferences: {
                        customGlobalCss: "",
                        defaultColour: "#b114ff",
                        defaultForegroundColour: "#ffffff",
                        enableGames: true,
                        experiments: false
                    }
                }
            }
        );
        await userCache.updateUser(req.user.id);

        res.redirect("/users/@me");
    }
);

module.exports = router;

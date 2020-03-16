const express = require("express");
const chunk = require("chunk");
const router = express.Router();

const discord = require("../Util/Services/discord.js");
const banned = require("../Util/Services/banned.js");
const variables = require("../Util/Function/variables.js");
const permission = require("../Util/Function/permissions.js");

router.get("/:id", variables, async (req, res, next) => {
    if (req.params.id === "@me") {
        if (!req.user) return res.redirect("/login");
        req.params.id = req.user.id;
    }

    const dbUser = await req.app.db.collection("users").findOne({ id: req.params.id });
    if (!dbUser) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("This user does not exist in our website database"),
        req,
        type: "Error"
    });

    const bots = await req.app.db.collection("bots").find().sort({ name: 1 }).toArray();

    const botsOwner = [];
    const botsEditor = [];
    const archivedBots = [];

    for (var n = 0; n < bots.length; ++n) {
        const bot = bots[n];

        if (bot.status.archived === true) {
            archivedBots.push(bot);
        } else if (bot.owner.id === req.params.id) {
            botsOwner.push(bot);
        } else if (bot.editors.includes(req.params.id)) {
            botsEditor.push(bot);
        }
    }

    const servers = await req.app.db.collection("servers").find().sort({ name: 1 }).toArray();
    
    const serversOwner = [];

    for (var n = 0; n < servers.length; ++n) {
        const server = servers[n];

        if (req.params.id === server.owner.id) {
            archivedBots.push(bot);
        }
    }

    const botOwnerChunk = chunk(botsOwner, 3);
    const botEditorChunk = chunk(botsEditor, 3);
    const archivedBotsChunk = chunk(archivedBots, 3);
    const serverOwnerChunk = chunk(serversOwner, 3);

    res.render("templates/users/profile", {
        title: dbUser.fullUsername + res.__("'s Profile"),
        subtitle: dbUser.profile.bio,
        userProfile: dbUser,
        req,
        userStatus: await discord.getStatus(dbUser.id),
        userProfileIsBanned: await banned.check(dbUser.id),
        botsOwnerData: botsOwner,
        botOwnerChunk,
        botsEditorData: botsEditor,
        botEditorChunk,
        archivedBotsData: archivedBots,
        archivedBotsChunk,
        serversOwnerData: serversOwner,
        serverOwnerChunk
    });
});

router.get("/:id/rank", variables, permission.auth, permission.assistant, async (req, res, next) => {
    const targetUser = await req.app.db.collection("users").findOne({ id: req.params.id });

    if (!targetUser) return res.status(404).render("status", {
        title: req.__("Error"),
        status: 404,
        subtitle: req.__("This user does not exist in our website database"),
        req,
        type: "Error"
    });

    res.render("templates/users/staffActions/modifyRank", { title: res.__("Modify Rank"), subtitle: res.__("Modifiying rank of: ") + targetUser.fullUsername, user: req.user, req: req, targetUser: targetUser });
});

router.post("/:id/rank", variables, permission.auth, permission.assistant, async (req, res, next) => {
    const targetUser = await req.app.db.collection("users").findOne({ id: req.params.id });

    if (!targetUser) return res.status(404).render("status", {
        title: req.__("Error"),
        status: 404,
        subtitle: req.__("This user does not exist in our website database"),
        req,
        type: "Error"
    });

    let verified = false;
    let bugHunter = false; 
    let mod = false;
    let assistant = false;
    let admin = false;

    if (req.body.bugHunter === "on") bugHunter = true;
    if (req.body.verified === "on") verified = true;

    if (req.body.rank === "mod") {
        mod = true;
    }

    if (req.user.db.rank === "assistant" && req.body.rank === "assistant" || req.body.rank === "admin") {
        return res.status(403).render("status", {
            title: res.__("Error"),
            status: 403,
            message: res.__("You cannot set a rank that is the same or higher than your own rank"),
            req,
            type: "Error"
        });
    } else if (targetUser.rank === "assistant" || targetUser.rank === "admin") {
        return res.status(403).render("status", {
            title: res.__("Error"),
            status: 403,
            message: res.__("You cannot modify a user's rank if they have the same or a higher rank than you"),
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

    req.app.db.collection("audit").insertOne({
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
                    bugHunter: targetUser.rank.bugHunter,
                    verified: targetUser.rank.verified
                }
            },
            new: {
                rank: {
                    admin: admin,
                    assistant: assistant,
                    mod: mod,
                    bugHunter: bugHunter,
                    verified: verified
                }
            }
        }
    });

    res.redirect(`/users/${targetUser.id}`);
});

router.get("/:id/ban", variables, permission.auth, permission.mod, async (req, res, next) => {
    const targetUser = await req.app.db.collection("users").findOne({ id: req.params.id });

    if (!targetUser) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("This user does not exist in our website database"),
        req,
        type: "Error"
    });

    res.render("templates/users/staffActions/banUser", { title: "Ban User", user: req.user, req: req, targetUser: targetUser });
});

router.post("/:id/ban", variables, permission.auth, permission.mod, async (req, res, next) => {
    const targetUser = await req.app.db.collection("users").findOne({ id: req.params.id });

    if (!targetUser) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("This user does not exist in our website database"),
        req,
        type: "Error"
    });

    const guild = await discord.bot.guilds.get(settings.guild.main);
    guild.ban(targetUser.id, req.body.reason)
        .then(() => {
            discord.bot.channels.get(settings.channels.punishmentLog).send(`:hammer: | **${targetUser.fullUsername}** (\`${targetUser.id}\`) has been banned via the website.\n**Moderator:** ${req.user.db.fullUsername} (\`${req.user.db.id}\`)\n**Reason:** ${req.body.reason}\n**Expiry:** n/a`);
            res.status(200).render("status", {
                title: res.__("Success"),
                status: 200,
                subtitle: res.__("Successfully banned: ") + targetUser.fullUsername,
                req,
                type: "Success"
            });

            req.app.db.collection("audit").insertOne({
                type: "BAN_USER",
                executor: req.user.id,
                target: targetUser.id,
                date: Date.now(),
                reason: req.body.reason
            });
        }).catch(e => {
            console.error(e);
            res.status(500).render("status", {
                title: res.__("Error"),
                status: 500,
                subtitle: res.__("An error occurred and I was unable to ban: ") + targetUser.fullUsername,
                req,
                type: "Error"
            });
    });
});

router.get("/profile/:id", (req, res, next) => {
    res.redirect("/" + req.params.id)
});

router.get("/profile/:id/edit", variables, permission.auth, async (req, res, next) => {
    if (req.params.id === "@me") {
        req.params.id = req.user.id;
    }

    const userProfile = await req.app.db.collection("users").findOne({ id: req.params.id });
    if (!userProfile) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("This user does not exist in our website database"),
        req,
        type: "Error"
    });
    
    if (userProfile.id !== req.user.id && req.user.db.rank.assistant === false) return res.status(403).render("status", {
        title: res.__("Error"),
        status: 403,
        subtitle: res.__("You do not have the required permission(s) to edit this user's profile."),
        req: req,
        type: "Error"
    });

    res.render("templates/users/editProfile", { title: res.__("Edit Profile"), subtitle: res.__("Editing profile: ") + req.user.db.fullUsername, req, userProfile: userProfile });
});

router.post("/profile/:id/edit", variables, permission.auth, async (req, res, next) => {
    if (req.params.id === "@me") {
        req.params.id = req.user.id;
    }

    const userProfile = await req.app.db.collection("users").findOne({ id: req.params.id });
    if (!userProfile) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("This user does not exist in our website database"),
        req: req
    });
    
    if (userProfile.id !== req.user.id && req.user.db.rank.assistant === false) return res.status(403).render("status", {
        title: res.__("Error"),
        status: 403,
        subtitle: res.__("You do not have the required permission(s) to edit this user's profile."),
        req: req,
        type: "Error"
    });

    let customCss;
    if (userProfile.rank.verified) {
        customCss = req.body.profileCss;
    } else {
        customCss = "";
    }

    req.app.db.collection("users").updateOne({ id: req.user.id }, 
        { $set: {
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
    });

    req.app.db.collection("audit").insertOne({
        type: "MODIFY_PROFILE",
        executor: req.user.id,
        target: targetUser.id,
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

    res.redirect("/users/@me");
});

router.get("/game/snake", variables, permission.auth, async (req, res, next) => {
    res.render("templates/users/snake", {
        title: res.__("Play Snake"),
        subtitle: res.__("Play the awesome snake game found on status pages!"),
        req
    });
})

router.get("/profile/game/snakes", variables, permission.auth, async (req, res, next) => {
    const user = await req.app.db.collection("users").findOne({ id: req.user.id });

    res.status(200).json({ error: false, status: 200, result: user.game.snakes.maxScore });
});

router.post("/profile/game/snakes", variables, permission.auth, async (req, res, next) => {
    if (req.body.score <= req.user.db.game.snakes.maxScore) return res.status(202).json({
        error: false,
        status: 202,
        message: "Posted score is lower or equal to the user's current high score - no changes were made"
    });

    const user = await req.app.db.collection("users").findOne({ id: req.user.id });
    const score = user.game.snakes.maxScore + 1;
    
    req.app.db.collection("users").updateOne({ id: req.user.id }, 
        { $set: {
            game: {
                snakes: {
                    maxScore: score
                }
            }
        }
    });

    req.app.db.collection("audit").insertOne({
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

    res.status(200).json({ error: false, status: 200, message: "Updated high score" });
});

router.get("/account/preferences", variables, permission.auth, async (req, res, next) => {
    res.render("templates/users/accountPreferences", { title: res.__("Preferences"), subtitle: res.__("Edit your account preferences"), req });
});

router.post("/account/preferences", variables, permission.auth, async (req, res, next) => {
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

    req.app.db.collection("users").updateOne({ id: req.user.id }, 
        { $set: {
            preferences: {
                customGlobalCss: req.body.customCss,
                enableGames: gamePreferences,
                experiments: experiments
            }
        }
    });

    req.app.db.collection("audit").insertOne({
        type: "MODIFY_PREFERENCES",
        executor: req.user.id,
        target: req.user.id,
        date: Date.now(),
        reason: req.body.reason || "None specified.",
        details: {
            old: {
                preferences: {
                    customGlobalCss: req.user.preferences.customCss,
                    enableGames: req.user.preferences.enableGames,
                    experiments: req.user.preferences.experiments
                }
            },
            new: {
                preferences: {
                    customGlobalCss: req.body.customCss,
                    enableGames: gamePreferences,
                    experiments: experiments
                }
            }
        }
    });

    res.redirect("/users/@me");
});

module.exports = router;
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

const bodyParser = require("body-parser");
const passport = require("passport");
const Strategy = require("passport-discord").Strategy;

const settings = require("../../settings.json");
const ddosMode = require("../Util/Services/ddosMode.js");

passport.use(
    new Strategy(
        {
            clientID: settings.client.id,
            clientSecret: settings.client.secret,
            callbackURL: settings.website.url + settings.website.callback,
            scope: settings.website.authScopes,
            authorizationURL: "https://discord.com/oauth2/authorize?prompt=none"
        },
        (accessToken, refreshToken, profile, done) => {
            process.nextTick(() => {
                return done(null, profile);
            });
        }
    )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

router.use(bodyParser.json());
router.use(
    bodyParser.urlencoded({
        extended: true
    })
);

// router.get("*", async (req, res, next) => {
//     if (ddosMode.getDDOSMode().active === false) {
//         next();
//     } else {
//         return res.status(403).json({ message: "fuckign ddos moade cunt" });
//     }
// });

router.get("/login", passport.authenticate("discord"));

router.get(
    "/login/callback",
    passport.authenticate("discord", { failureRedirect: "/login" }),
    async (req, res, next) => {
        const user = await req.app.db
            .collection("users")
            .findOne({ _id: req.user.id });

        if (!user) {
            await req.app.db.collection("users").insertOne({
                _id: req.user.id,
                token: req.user.accessToken,
                name: req.user.username,
                discrim: req.user.discriminator,
                fullUsername: req.user.username + "#" + req.user.discriminator,
                locale: req.user.locale,
                flags: req.user.flags,
                avatar: {
                    hash: req.user.avatar,
                    url: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}`
                },
                preferences: {
                    customGlobalCss: "",
                    defaultColour: "#b114ff",
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
            if (user.rank.mod === true) {
                await req.app.db.collection("users").updateOne(
                    { _id: req.user.id },
                    {
                        $set: {
                            token: req.user.accessToken,
                            name: req.user.username,
                            discrim: req.user.discriminator,
                            fullUsername:
                                req.user.username +
                                "#" +
                                req.user.discriminator,
                            locale: req.user.locale,
                            flags: req.user.flags,
                            avatar: {
                                hash: req.user.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}`
                            },
                            "staffTracking.lastLogin": Date.now()
                        }
                    }
                );
            } else {
                await req.app.db.collection("users").updateOne(
                    { _id: req.user.id },
                    {
                        $set: {
                            token: req.user.accessToken,
                            name: req.user.username,
                            discrim: req.user.discriminator,
                            fullUsername:
                                req.user.username +
                                "#" +
                                req.user.discriminator,
                            locale: req.user.locale,
                            flags: req.user.flags,
                            avatar: {
                                hash: req.user.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}`
                            }
                        }
                    }
                );
            }
        }

        res.redirect(req.session.redirectTo || "/");
    }
);

router.get("/logout", async (req, res, next) => {
    if (!req.user.impersonator) {
        await req.logout();
        res.redirect(req.session.redirectTo || "/");
    } else {
        req.user.id = req.user.impersonator;
        req.user.impersonator = undefined;
        res.redirect("/");
    }
});

module.exports = router;

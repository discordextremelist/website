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
const serverUpdate = require("../Util/Services/serverUpdate.js");

passport.use(new Strategy ({
    clientID: settings.client.id,
    clientSecret: settings.client.secret,
    callbackURL: settings.website.url + settings.website.callback,
    scope: settings.website.authScopes,
    authorizationURL: "https://discordapp.com/api/oauth2/authorize?prompt=none"
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => {
        return done(null, profile);
    });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({
    extended: true
}));

router.get("/dev/authinfo", (req, res, next) => {
    res.json(req.user);
});

router.get("/login", passport.authenticate("discord"));

router.get("/login/callback", passport.authenticate("discord", { failureRedirect: "/login" }), async (req, res, next) => {
    const user = await req.app.db.collection("users").findOne({ id: req.user.id });

    if (!user) {
        req.app.db.collection("users").insertOne({
            id: req.user.id,
            token: req.user.accessToken,
            name: req.user.username,
            discrim: req.user.discriminator,
            fullUsername: req.user.username + "#" + req.user.discriminator,
            locale: req.user.locale,
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
                bugHunter: false
            },
            status: {
                pendingStaff: false
            },
            staffTracking: {
                lastLogin: undefined,
                lastAccessed: {
                    time: undefined,
                    page: undefined
                },
                handledBots: {
                    total: undefined,
                    approved: undefined,
                    declined: undefined
                }
            }
        })
    } else {
        if (user.rank.mod === true) {
            await req.app.db.collection("users").updateOne({ id: req.user.id }, 
                { $set: {
                    token: req.user.accessToken,
                    name: req.user.username,
                    discrim: req.user.discriminator,
                    fullUsername: req.user.username + "#" + req.user.discriminator,
                    locale: req.user.locale,
                    avatar: {
                        hash: req.user.avatar,
                        url: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}`
                    },
                    "staffTracking.lastLogin": Date.now()
                }
            });

            for (let n = 0; n < req.user.guilds.length; n++) {
                await serverUpdate(req.user.guilds[n].id, req.user.guilds, false);
            }
        } else {
            await req.app.db.collection("users").updateOne({ id: req.user.id }, 
                { $set: {
                    token: req.user.accessToken,
                    name: req.user.username,
                    discrim: req.user.discriminator,
                    fullUsername: req.user.username + "#" + req.user.discriminator,
                    locale: req.user.locale,
                    avatar: {
                        hash: req.user.avatar,
                        url: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}`
                    }
                }
            });

            for (let n = 0; n < req.user.guilds.length; n++) {
                await serverUpdate(req.user.guilds[n].id, req.user.guilds, false);
            }
        }
    }

    res.redirect(req.session.redirectTo || "/");
});

router.get("/logout", async (req, res, next) => {
    await req.logout();
    res.redirect(req.session.redirectTo || "/");
});

module.exports = router;

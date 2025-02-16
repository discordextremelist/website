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

import express from "express";
import passport from "passport";
import { Strategy } from "passport-discord";
import type { VerifyCallback } from "passport-oauth2";
import refresh from "passport-oauth2-refresh";
import * as discord from "../Util/Services/discord.ts";
import type {
    RESTPostOAuth2AccessTokenResult,
    RESTPutAPIGuildMemberJSONBody
} from "discord.js";
import { OAuth2Scopes, Routes, DiscordAPIError } from "discord.js";
import fetch from "node-fetch";
import * as userCache from "../Util/Services/userCaching.ts";
import { DAPI } from "../Util/Services/discord.ts";

import settings from "../../settings.json" with { type: "json" };
import * as tokenManager from "../Util/Services/adminTokenManager.ts";
import { grabFullUser } from "../Util/Function/main.ts";

const router = express.Router();

const strategy = new Strategy(
    {
        clientID: settings.secrets.discord.id,
        clientSecret: settings.secrets.discord.secret,
        callbackURL: settings.website.url + settings.website.callback
    },
    (
        _accessToken: string,
        refreshToken: string,
        params: RESTPostOAuth2AccessTokenResult,
        profile: Strategy.Profile,
        done: VerifyCallback
    ) => {
        process.nextTick(() => {
            return done(null, { ...profile, refreshToken, ...params });
        });
    }
);

passport.use(strategy);
refresh.use(strategy);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

router.get("/login/joinGuild", (req, res) => {
    req.session.joinGuild = true;
    res.redirect(
        `/auth/login/callback?scope=${OAuth2Scopes.Identify} ${OAuth2Scopes.GuildsJoin}`
    );
});

router.get(
    "/login/callback",
    (req, res, next) =>
        passport.authenticate("discord", {
            failureRedirect: "/auth/login",
            prompt: "none",
            scope: (req.query.scope as string) || OAuth2Scopes.Identify
        })(req, res, next),

    async (req, res, next) => {
        const user: delUser = await global.db
            .collection<delUser>("users")
            .findOne({ _id: req.user.id });

        const { scopes } = (await (
            await fetch(DAPI + Routes.oauth2CurrentAuthorization(), {
                headers: { authorization: `Bearer ${req.user.accessToken}` }
            })
        ).json()) as { scopes: OAuth2Scopes[] };

        if (!user) {
            const handleDefault: delUser["staffTracking"]["handledBots"] = {
                allTime: {
                    total: 0,
                    approved: 0,
                    unapprove: 0,
                    declined: 0,
                    remove: 0,
                    modHidden: 0
                },
                prevWeek: {
                    total: 0,
                    approved: 0,
                    unapprove: 0,
                    declined: 0,
                    remove: 0,
                    modHidden: 0
                },
                thisWeek: {
                    total: 0,
                    approved: 0,
                    unapprove: 0,
                    declined: 0,
                    remove: 0,
                    modHidden: 0
                }
            };

            await global.db.collection<delUser>("users").insertOne({
                _id: req.user.id,
                auth: {
                    accessToken: req.user.accessToken,
                    refreshToken: req.user.refreshToken,
                    expires: Date.now() + req.user.expires_in * 1000,
                    scopes
                },
                name: req.user.username,
                discrim: req.user.discriminator,
                fullUsername: grabFullUser(req.user),
                locale: req.user.locale,
                flags: req.user.flags,
                lastDataRequest: null,
                avatar: {
                    hash: req.user.avatar,
                    url: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}`
                },
                preferences: {
                    customGlobalCss: "",
                    defaultColour: "#BA2EFF",
                    defaultForegroundColour: "#ffffff",
                    enableGames: true,
                    experiments: false,
                    theme: 0
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
                    premium: false,
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
                    handledBots: handleDefault,
                    handledServers: handleDefault,
                    handledTemplates: handleDefault
                }
            } satisfies delUser);
        } else {
            const importUser = {
                auth: {
                    accessToken: req.user.accessToken,
                    refreshToken: req.user.refreshToken,
                    expires: Date.now() + req.user.expires_in * 1000,
                    scopes
                },
                name: req.user.username,
                discrim: req.user.discriminator,
                fullUsername: grabFullUser(req.user),
                locale: req.user.locale,
                flags: req.user.flags,
                avatar: {
                    hash: req.user.avatar,
                    url: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}`
                }
            } as delUser;

            if (user.rank.mod === true)
                importUser["staffTracking.lastLogin"] = Date.now();

            await global.db.collection("users").updateOne(
                { _id: req.user.id },
                {
                    $set: importUser
                }
            );
        }

        await userCache.updateUser(req.user.id);

        if (req.session.joinGuild && req.session.joinGuild === true) {
            req.session.joinGuild = false;
            try {
                await discord.bot.rest.put(
                    Routes.guildMember(settings.guild.main, req.user.id),
                    {
                        body: {
                            access_token: req.user.accessToken
                        } satisfies RESTPutAPIGuildMemberJSONBody
                    }
                );
            } catch (error) {
                console.error(error);
                if (
                    error instanceof DiscordAPIError &&
                    error.code === 403 &&
                    !req.user.impersonator
                ) {
                    return res.status(403).render("status", {
                        res,
                        title: res.__("common.error"),
                        status: 403,
                        subtitle: res.__("common.error.notMember"),
                        req,
                        type: "Error"
                    });
                }
                return next(error);
            }
        }

        res.redirect(req.session.redirectTo || "/");
    }
);

router.get("/logout", async (req, res, next) => {
    if (req.user && !req.user.impersonator) {
        req.session.logoutJust = true;
        if (req.user.db.rank.admin) await tokenManager.tokenReset(req.user.id);

        req.logout((err) => {
            if (err) {
                return next(err);
            }
            res.redirect(req.session.redirectTo || "/");
        });
    } else {
        req.user.id = req.user.impersonator;
        req.user.impersonator = undefined;
        res.redirect("/");
    }
});

export default router;

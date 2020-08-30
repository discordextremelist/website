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
import { Response as fetchRes } from "../../@types/fetch";
import { APIUser } from "discord-api-types/v6";

import * as fetch from "node-fetch";

import * as settings from "../../settings.json";
import * as permission from "../Util/Function/permissions";
import * as functions from "../Util/Function/main";
import * as botCache from "../Util/Services/botCaching";
import * as serverCache from "../Util/Services/serverCaching";
import * as templateCache from "../Util/Services/templateCaching";
import * as auditCache from "../Util/Services/auditCaching";
import * as userCache from "../Util/Services/userCaching";
import * as announcementCache from "../Util/Services/announcementCaching";
import { variables } from "../Util/Function/variables";
import * as tokenManager from "../Util/Services/adminTokenManager";
import * as discord from "../Util/Services/discord";

const router = express.Router();

router.get(
    "/",
    variables,
    permission.mod,
    async (req: Request, res: Response) => {
        const bots = await botCache.getAllBots();
        const users = await userCache.getAllUsers();
        const servers = await serverCache.getAllServers();
        const templates = await templateCache.getAllTemplates();

        res.locals.premidPageInfo = res.__("premid.staff.home");

        res.render("templates/staff/index", {
            title: res.__("common.nav.me.staffPanel"),
            subtitle: res.__("common.nav.me.staffPanel.subtitle"),
            user: req.user,
            req,
            siteStats: {
                botCount: bots.length,
                serverCount: servers.length,
                userCount: users.length,
                templateCount: templates.length,
                unapprovedBots: bots.filter(
                    (b) => !b.status.approved && !b.status.archived
                ).length
            }
        });
    }
);

router.get(
    "/queue",
    variables,
    permission.mod,
    (req: Request, res: Response) => {
        res.redirect("/bot_queue");
    }
);

router.get(
    "/bot_queue",
    variables,
    permission.mod,
    async (req: Request, res: Response) => {
        const bots: delBot[] = await global.db
            .collection("bots")
            .find()
            .sort({ "date.submitted": -1 })
            .toArray();

        res.locals.premidPageInfo = res.__("premid.staff.queue");

        res.render("templates/staff/queue", {
            title: res.__("page.staff.queue"),
            subtitle: res.__("page.staff.queue.subtitle"),
            req,
            bots: bots.filter(
                ({ status }) => !status.approved && !status.archived
            ),
            mainServer: settings.guild.main,
            staffServer: settings.guild.staff
        });
    }
);

router.get(
    "/server_queue",
    variables,
    permission.mod,
    async (req: Request, res: Response) => {
        const servers: delServer[] = await global.db
            .collection("servers")
            .find()
            .sort({ "date.submitted": -1 })
            .toArray();

        res.locals.premidPageInfo = res.__("premid.staff.server_queue");

        res.render("templates/staff/server_queue", {
            title: res.__("page.staff.server_queue"),
            subtitle: res.__("page.staff.server_queue.subtitle"),
            req,
            servers: servers.filter(
                ({ status }) => status && status.reviewRequired
            )
        });
    }
);

router.get(
    "/invite_queue",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        const bots: delBot[] = await global.db
            .collection("bots")
            .find()
            .sort({ "date.submitted": -1 })
            .toArray();

        for (const bot of bots) {
            discord.bot.guilds.cache
                .get(settings.guild.main)
                .members.cache.get(bot._id)
                ? (bot.inServer = true)
                : (bot.inServer = false);
        }

        res.locals.premidPageInfo = res.__("premid.staff.invite_queue");

        res.render("templates/staff/invite_queue", {
            title: res.__("page.staff.invite_queue"),
            subtitle: res.__("page.staff.invite_queue.subtitle"),
            req,
            bots: bots.filter(
                ({ inServer, status }) =>
                    !inServer && !status.archived && status.approved && !status.siteBot
            ),
            mainServer: settings.guild.main,
            staffServer: settings.guild.staff
        });
    }
);

router.get(
    "/audit",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        const logs: auditLog[] = await auditCache.getAllAuditLogs();

        if (!req.query.page) req.query.page = "1";

        let iteratedLogs: auditLog[] = logs.slice(
            15 * Number(req.query.page) - 15,
            15 * Number(req.query.page)
        );

        for (const log of iteratedLogs) {
            log.executor = await functions.auditUserIDParse(log.executor);
            log.target = await functions.auditUserIDParse(log.target);
        }

        res.locals.premidPageInfo = res.__("premid.staff.audit");

        res.render("templates/staff/audit", {
            title: res.__("page.staff.audit"),
            subtitle: res.__("page.staff.audit.subtitle"),
            req,
            logs,
            logsPgArr: iteratedLogs,
            page: req.query.page,
            pages: Math.ceil(logs.length / 15),
            functions
        });
    }
);

router.get(
    "/staff-manager",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        const users: delUser[] = await global.db
            .collection("users")
            .find()
            .toArray();

        res.locals.premidPageInfo = res.__("premid.staff.staffManager");
        for (const user of users) {
            for (const warning of user.staffTracking.punishments.warnings) {
                let executor = await userCache.getUser(warning.executor);
                if (!executor) {
                    executor = await global.db
                        .collection("users")
                        .findOne({ _id: warning.executor });
                }

                warning.executorName = executor.fullUsername;
            }

            for (const strike of user.staffTracking.punishments.strikes) {
                let executor = await userCache.getUser(strike.executor);
                if (!executor) {
                    executor = await global.db
                        .collection("users")
                        .findOne({ _id: strike.executor });
                }

                strike.executorName = executor.fullUsername;
            }
        }

        res.render("templates/staff/manager", {
            title: res.__("page.staff.manager"),
            subtitle: res.__("page.staff.manager.subtitle"),
            req,
            admin: users.filter(({ rank }) => rank.admin),
            assistant: users.filter(
                ({ rank }) => rank.assistant && !rank.admin
            ),
            mod: users.filter(
                ({ rank }) => rank.mod && !rank.assistant && !rank.admin
            ),
            functions,
            userCache
        });
    }
);

router.get(
    "/staff-manager/away/:id",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        const user: delUser | undefined = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
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

        res.render("templates/staff/staffManagement/away", {
            title: res.__("page.staff.manager.setAway"),
            subtitle: res.__(
                "page.staff.manager.setAway.subtitle",
                user.fullUsername
            ),
            req,
            user
        });
    }
);

router.post(
    "/staff-manager/away/:id",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        const user: delUser | undefined = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
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

        res.locals.premidPageInfo = res.__(
            "premid.staff.staffManager.updateAway",
            user.fullUsername
        );

        await global.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.details.away.status": true,
                    "staffTracking.details.away.message": req.body.reason
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "UPDATE_AWAY",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    away: {
                        status: user.staffTracking.details.away.status,
                        message: user.staffTracking.details.away.message
                    }
                },
                new: {
                    away: {
                        status: true,
                        message: req.body.reason
                    }
                }
            }
        });

        res.redirect("/staff/staff-manager");
    }
);

router.get(
    "/staff-manager/away/:id/reset",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        const user: delUser | undefined = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
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

        await global.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.details.away.status": false,
                    "staffTracking.details.away.message": ""
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "RESET_AWAY",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    away: {
                        status: user.staffTracking.details.away.status,
                        message: user.staffTracking.details.away.message
                    }
                },
                new: {
                    away: {
                        status: false,
                        message: ""
                    }
                }
            }
        });

        res.redirect("/staff/staff-manager");
    }
);

router.get(
    "/staff-manager/standing/:id",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        const user: delUser | undefined = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
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

        res.locals.premidPageInfo = res.__(
            "premid.staff.staffManager.modifyStanding",
            user.fullUsername
        );

        res.render("templates/staff/staffManagement/standing", {
            title: res.__("page.staff.manager.setStanding"),
            subtitle: res.__(
                "page.staff.manager.setStanding.subtitle",
                user.fullUsername
            ),
            req,
            user,
            standings: [
                {
                    _id: "Unmeasured",
                    display: res.__("page.staff.manager.unmeasured.emoji")
                },
                {
                    _id: "Good",
                    display: res.__("page.staff.manager.good.emoji")
                },
                {
                    _id: "Moderate",
                    display: res.__("page.staff.manager.moderate.emoji")
                },
                {
                    _id: "Moderate-Bad",
                    display: res.__("page.staff.manager.moderateBad.emoji")
                },
                {
                    _id: "Bad",
                    display: res.__("page.staff.manager.bad.emoji")
                }
            ],
            functions
        });
    }
);

router.post(
    "/staff-manager/standing/:id",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        const user: delUser | undefined = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
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

        let allowedStandings = [
            "Unmeasured",
            "Good",
            "Moderate",
            "Moderate-Bad",
            "Bad"
        ];
        let standing = req.body.standing;

        if (!allowedStandings.includes(standing)) {
            standing = "Unmeasured";
        }

        await global.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.details.standing": standing
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "MODIFY_STANDING",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    standing: user.staffTracking.details.standing
                },
                new: {
                    standing: standing
                }
            }
        });

        res.redirect("/staff/staff-manager");
    }
);

router.get(
    "/staff-manager/punish/warn/:id",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        const user: delUser | undefined = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
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

        res.locals.premidPageInfo = res.__(
            "premid.staff.staffManager.warn",
            user.fullUsername
        );

        res.render("templates/staff/staffManagement/warn", {
            title: res.__("page.staff.manager.warn"),
            subtitle: res.__(
                "page.staff.manager.warn.subtitle",
                user.fullUsername
            ),
            req,
            user
        });
    }
);

router.post(
    "/staff-manager/punish/warn/:id",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        const user: delUser | undefined = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
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

        const warnings = user.staffTracking.punishments.warnings;
        warnings.push({
            executor: req.user.id,
            reason: req.body.reason,
            date: Date.now()
        });

        await global.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.punishments.warnings": warnings
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "ADD_WARNING",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                new: {
                    executor: req.user.id,
                    reason: req.body.reason,
                    date: Date.now()
                }
            }
        });

        res.redirect("/staff/staff-manager");
    }
);

router.get(
    "/staff-manager/punish/strike/:id",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        const user: delUser | undefined = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
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

        res.locals.premidPageInfo = res.__(
            "premid.staff.staffManager.strike",
            user.fullUsername
        );

        res.render("templates/staff/staffManagement/strike", {
            title: res.__("page.staff.manager.strike"),
            subtitle: res.__(
                "page.staff.manager.strike.subtitle",
                user.fullUsername
            ),
            req,
            user
        });
    }
);

router.post(
    "/staff-manager/punish/strike/:id",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        const user: delUser | undefined = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        if (!user)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.user.404"),
                req,
                type: "Error"
            });

        if (
            user.rank.assistant === true &&
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

        const strikes = user.staffTracking.punishments.strikes;
        strikes.push({
            executor: req.user.id,
            reason: req.body.reason,
            date: Date.now()
        });

        await global.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.punishments.strikes": strikes
                }
            }
        );

        await global.db.collection("audit").insertOne({
            type: "ADD_STRIKE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                new: {
                    executor: req.user.id,
                    reason: req.body.reason,
                    date: Date.now()
                }
            }
        });

        res.redirect("/staff/staff-manager");
    }
);

router.get(
    "/announce",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        res.locals.premidPageInfo = res.__("premid.staff.announcer");

        res.render("templates/staff/announce", {
            title: res.__("page.staff.announcer"),
            subtitle: res.__("page.staff.announcer.subtitle"),
            req: req
        });
    }
);

router.post(
    "/announce",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        let foreground: string;
        let colour: string = req.body.colour;

        if (req.body.colour === "preferred") {
            foreground = "preferred";
        } else if (req.body.colour === "custom") {
            colour = req.body.customColour;
            foreground = functions.getForeground(req.body.customColour);
        } else {
            foreground = functions.getForeground(req.body.colour);
        }

        await announcementCache.updateAnnouncement(
            {
                active: true,
                message: req.body.message,
                colour: colour,
                foreground: foreground
            },
            req
        );

        res.render("templates/staff/announceWithNotif", {
            title: res.__("page.staff.announcer"),
            subtitle: res.__("page.staff.announcer.subtitle"),
            req: req,
            notification: res.__("page.staff.announcer.setSuccess")
        });
    }
);

router.get(
    "/announce/reset",
    variables,
    permission.assistant,
    async (req: Request, res: Response) => {
        announcementCache.updateAnnouncement(
            {
                active: false,
                message: "",
                colour: "",
                foreground: ""
            },
            req
        );

        res.render("templates/staff/announceWithNotif", {
            title: res.__("page.staff.announcer"),
            subtitle: res.__("page.staff.announcer.subtitle"),
            req: req,
            notification: res.__("page.staff.announcer.resetSuccess")
        });
    }
);

router.get(
    "/site-manager",
    variables,
    permission.mod,
    async (req: Request, res: Response) => {
        res.redirect("/");
    }
);

router.get(
    "/mask/:id",
    variables,
    permission.admin,
    async (req: Request, res: Response) => {
        if (req.params.id === req.user.id) return res.redirect("/staff");

        if (!req.query.token) return res.json({});
        const tokenCheck = await tokenManager.verifyToken(
            req.user.id,
            req.query.token as string
        );
        if (tokenCheck === false) return res.json({});

        let user: delUser | undefined = await global.db
            .collection("users")
            .findOne({ _id: req.params.id });

        fetch(`https://discord.com/api/v6/users/${req.params.id}`, {
            method: "GET",
            headers: { Authorization: `Bot ${settings.secrets.discord.token}` }
        })
            .then(async (fetchRes: fetchRes) => {
                const discordUser = (await fetchRes.json()) as APIUser;

                if (!user) {
                    await global.db.collection("users").insertOne({
                        _id: req.params.id,
                        token: "",
                        name: discordUser.username,
                        discrim: discordUser.discriminator,
                        fullUsername:
                            discordUser.username +
                            "#" +
                            discordUser.discriminator,
                        locale: "",
                        avatar: {
                            hash: discordUser.avatar,
                            url: `https://cdn.discordapp.com/avatars/${req.params.id}/${discordUser.avatar}`
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
                                    discordUser.username +
                                    "#" +
                                    discordUser.discriminator,
                                avatar: {
                                    hash: discordUser.avatar,
                                    url: `https://cdn.discordapp.com/avatars/${req.params.id}/${discordUser.avatar}`
                                }
                            }
                        }
                    );
                }

                user = await global.db
                    .collection("users")
                    .findOne({ _id: req.params.id });
                if (!req.user.impersonator) req.user.impersonator = req.user.id;
                req.user.id = req.params.id;
                req.user.db = user;
                res.redirect("/");
            })
            .catch(() => {
                return res.redirect("/staff");
            });
    }
);

module.exports = router;

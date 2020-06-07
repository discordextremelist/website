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
const fetch = require("node-fetch");
const chunk = require("chunk");

const settings = require("../../settings.json");
const variables = require("../Util/Function/variables.js");
const permission = require("../Util/Function/permissions.js");
const functions = require("../Util/Function/main.js");
const userCache = require("../Util/Services/userCaching.js");
const announcementCache = require("../Util/Services/announcementCaching.js");

router.get("/", variables, permission.mod, async (req, res) => {
    const bots = await req.app.db.collection("bots").find().toArray();
    const users = await req.app.db.collection("users").find().toArray();
    const servers = await req.app.db.collection("servers").find().toArray();

    res.locals.premidPageInfo = res.__("premid.staff.home");

    res.render("templates/staff/index", {
        title: res.__("common.nav.me.staffPanel"),
        subtitle: res.__("common.nav.me.staffPanel.subtitle"),
        user: req.user,
        req,
        stats: {
            botCount: bots.length,
            serverCount: servers.length,
            userCount: users.length,
            unapprovedBots: bots.filter(
                (b) => !b.status.approved && !b.status.archived
            ).length,
            strikes: req.user.db.staffTracking.punishments.strikes.length,
            warnings: req.user.db.staffTracking.punishments.warnings.length,
            standing: req.user.db.staffTracking.details.standing,
            away: req.user.db.staffTracking.details.away.status
                ? res.__("common.yes")
                : res.__("common.no")
        }
    });
});

router.get("/session", variables, permission.admin, (req, res) => {
    res.json(req.user.db);
});

router.get("/queue", variables, permission.mod, async (req, res) => {
    const bots = await req.app.db.collection("bots").find().toArray();

    res.locals.premidPageInfo = res.__("premid.staff.queue");

    res.render("templates/staff/queue", {
        title: res.__("page.staff.queue"),
        subtitle: res.__("page.staff.queue.subtitle"),
        req,
        bots: bots.filter(({ status }) => !status.approved && !status.archived)
    });
});

router.get("/audit", variables, permission.assistant, async (req, res) => {
    const logs = await req.app.db
        .collection("audit")
        .find()
        .sort({ date: -1 })
        .toArray();
    const logsChunk = chunk(logs, 15);

    res.locals.premidPageInfo = res.__("premid.staff.audit");

    res.render("templates/staff/audit", {
        title: res.__("page.staff.audit"),
        subtitle: res.__("page.staff.audit.subtitle"),
        req,
        logsData: logs,
        logsChunk,
        page: req.query.page ? parseInt(req.query.page) : 1,
        pages: Math.ceil(logs.length / 15)
    });
});

router.get(
    "/staff-manager",
    variables,
    permission.assistant,
    async (req, res) => {
        const users = await req.app.db.collection("users").find().toArray();

        res.locals.premidPageInfo = res.__("premid.staff.staffManager");
        for (const user of users) {
            for (const warning of user.staffTracking.punishments.warnings) {
                let executor = await userCache.getUser(warning.executor);
                if (!executor) {
                    executor = await req.app.db
                        .collection("users")
                        .findOne({ _id: warning.executor });
                }

                warning.executorName = executor.fullUsername;
            }

            for (const strike of user.staffTracking.punishments.strikes) {
                let executor = await userCache.getUser(strike.executor);
                if (!executor) {
                    executor = await req.app.db
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
    async (req, res) => {
        const user = await req.app.db
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
    async (req, res) => {
        const user = await req.app.db
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

        await req.app.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.details.away.status": true,
                    "staffTracking.details.away.message": req.body.reason
                }
            }
        );

        await req.app.db.collection("audit").insertOne({
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
    async (req, res) => {
        const user = await req.app.db
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

        await req.app.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.details.away.status": false,
                    "staffTracking.details.away.message": ""
                }
            }
        );

        await req.app.db.collection("audit").insertOne({
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
    async (req, res) => {
        const user = await req.app.db
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
    async (req, res) => {
        const user = await req.app.db
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

        await req.app.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.details.standing": standing
                }
            }
        );

        await req.app.db.collection("audit").insertOne({
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
    async (req, res) => {
        const user = await req.app.db
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
    async (req, res) => {
        const user = await req.app.db
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

        await req.app.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.punishments.warnings": warnings
                }
            }
        );

        await req.app.db.collection("audit").insertOne({
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
    async (req, res) => {
        const user = await req.app.db
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
    async (req, res) => {
        const user = await req.app.db
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

        await req.app.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "staffTracking.punishments.strikes": strikes
                }
            }
        );

        await req.app.db.collection("audit").insertOne({
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

router.get("/announce", variables, permission.assistant, async (req, res) => {
    res.locals.premidPageInfo = res.__("premid.staff.announcer");

    res.render("templates/staff/announce", {
        title: res.__("page.staff.announcer"),
        subtitle: res.__("page.staff.announcer.subtitle"),
        req: req
    });
});

router.post("/announce", variables, permission.assistant, async (req, res) => {
    let foreground;
    let colour = req.body.colour;

    if (req.body.colour === "preferred") {
        foreground = "preferred";
    } else if (req.body.colour === "custom") {
        colour = req.body.customColour;
        foreground = functions.getForeground(req.body.customColour);
    } else {
        foreground = functions.getForeground(req.body.colour);
    }

    await announcementCache.updateAnnouncement({
        active: true,
        message: req.body.message,
        colour: colour,
        foreground: foreground
    });

    res.render("templates/staff/announceWithNotif", {
        title: res.__("page.staff.announcer"),
        subtitle: res.__("page.staff.announcer.subtitle"),
        req: req,
        notification: res.__("page.staff.announcer.setSuccess")
    });
});

router.get(
    "/announce/reset",
    variables,
    permission.assistant,
    async (req, res) => {
        announcementCache.updateAnnouncement({
            active: false,
            message: "",
            colour: "",
            foreground: ""
        });

        res.render("templates/staff/announceWithNotif", {
            title: res.__("page.staff.announcer"),
            subtitle: res.__("page.staff.announcer.subtitle"),
            req: req,
            notification: res.__("page.staff.announcer.resetSuccess")
        });
    }
);

router.get("/site-manager", variables, permission.mod, async (req, res) => {});

router.get("/mask/:id", variables, permission.admin, async (req, res) => {
    if (req.params.id === req.user.id) return res.redirect("/staff");
    let user = await req.app.db
        .collection("users")
        .findOne({ _id: req.params.id });

    fetch(`https://discord.com/api/v6/users/${req.params.id}`, {
        method: "GET",
        headers: { Authorization: `Bot ${settings.client.token}` }
    })
        .then(async (fetchRes) => {
            fetchRes.jsonBody = await fetchRes.json();

            if (!user) {
                await req.app.db.collection("users").insertOne({
                    _id: req.params.id,
                    token: "",
                    name: fetchRes.jsonBody.username,
                    discrim: fetchRes.jsonBody.discriminator,
                    fullUsername:
                        fetchRes.jsonBody.username +
                        "#" +
                        fetchRes.jsonBody.discriminator,
                    locale: "",
                    avatar: {
                        hash: fetchRes.jsonBody.avatar,
                        url: `https://cdn.discordapp.com/avatars/${req.params.id}/${fetchRes.jsonBody.avatar}`
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
                                declined: 0
                            },
                            prevWeek: {
                                total: 0,
                                approved: 0,
                                declined: 0
                            },
                            thisWeek: {
                                total: 0,
                                approved: 0,
                                declined: 0
                            }
                        }
                    }
                });
            } else {
                await req.app.db.collection("users").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            name: fetchRes.jsonBody.username,
                            discrim: fetchRes.jsonBody.discriminator,
                            fullUsername:
                                fetchRes.jsonBody.username +
                                "#" +
                                fetchRes.jsonBody.discriminator,
                            avatar: {
                                hash: fetchRes.jsonBody.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.params.id}/${fetchRes.jsonBody.avatar}`
                            }
                        }
                    }
                );
            }

            user = await req.app.db
                .collection("users")
                .findOne({ _id: req.params.id });
            if (!req.user.impersonator) req.user.impersonator = req.user.id;
            req.user.id = req.params.id;
            req.user.db = user;
            res.redirect("/");
        })
        .catch((_) => {
            return res.redirect("/staff");
        });
});

module.exports = router;

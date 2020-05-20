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

const settings = require("../../settings.json");
const variables = require("../Util/Function/variables.js");
const permission = require("../Util/Function/permissions.js");
const functions = require("../Util/Function/main.js");
const announcementCache = require("../Util/Services/announcementCaching.js");

router.get("/", variables, permission.mod, async(req, res) => {
    const bots = await req.app.db.collection("bots").find().toArray();
    const users = await req.app.db.collection("users").find().toArray();
    const servers = await req.app.db.collection("servers").find().toArray();

    res.render("templates/staff/index", {
        title: res.__("common.nav.me.staffPanel"),
        subtitle: res.__("common.nav.me.staffPanel.subtitle"),
        user: req.user,
        req,
        stats: {
            botCount: bots.length,
            serverCount: servers.length,
            userCount: users.length,
            unapprovedBots: bots.filter(b => !b.status.approved).length,
            strikes: req.user.db.staffTracking.punishments.strikes.length,
            warnings: req.user.db.staffTracking.punishments.warnings.length,
            standing: req.user.db.staffTracking.details.standing,
            away: req.user.db.staffTracking.details.away.status ? res.__("common.yes") : res.__("common.no")
        }
    });
});

router.get("/queue", variables, permission.mod, async(req, res) => {

});

router.get("/staff-manager", variables, permission.assistant, async(req, res) => {
    const users = (await req.app.db.collection("users").find().toArray());

    res.render("templates/staff/manager", {
        title: res.__("page.staff.manager"),
        subtitle: res.__("page.staff.manager.subtitle"),
        req,
        admin: users.filter(({ rank }) => rank.admin),
        assistant: users.filter(({ rank }) => rank.assistant && !rank.admin),
        mod: users.filter(({ rank }) => rank.mod && !rank.assistant && !rank.admin)
    });
});

router.get("/announce", variables, permission.assistant, async(req, res) => {
    res.render("templates/staff/announce", {
        title: res.__("page.staff.announcer"),
        subtitle: res.__("page.staff.announcer.subtitle"),
        req: req
    });
});

router.post("/announce", variables, permission.assistant, async(req, res) => {
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

router.get("/announce/reset", variables, permission.assistant, async(req, res) => {
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
});

router.get("/announce/info", variables, permission.assistant, async(req, res) => {
    res.json(res.locals.announcement);
});

router.get("/site-manager", variables, permission.mod, async(req, res) => {

});

router.get("/mask/:id", variables, permission.admin, async(req, res) => {
    if (req.params.id === req.user.id) return res.redirect("/staff");
    let user = await req.app.db.collection("users").findOne({ _id: req.params.id });

    fetch(`https://discord.com/api/v6/users/${req.params.id}`, { method: "GET", headers: { Authorization: `Bot ${settings.client.token}` } }).then(async(fetchRes) => {
        fetchRes.jsonBody = await fetchRes.json();
        
        if (!user) {
            await req.app.db.collection("users").insertOne({
                _id: req.params.id,
                token: "",
                name: fetchRes.jsonBody.username,
                discrim: fetchRes.jsonBody.discriminator,
                fullUsername: fetchRes.jsonBody.username + "#" + fetchRes.jsonBody.discriminator,
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
            })
        } else {
            await req.app.db.collection("users").updateOne({ _id: req.params.id }, 
                { $set: {
                    name: fetchRes.jsonBody.username,
                    discrim: fetchRes.jsonBody.discriminator,
                    fullUsername: fetchRes.jsonBody.username + "#" + fetchRes.jsonBody.discriminator,
                    avatar: {
                        hash: fetchRes.jsonBody.avatar,
                        url: `https://cdn.discordapp.com/avatars/${req.params.id}/${fetchRes.jsonBody.avatar}`
                    }
                }
            });
        }
    
        user = await req.app.db.collection("users").findOne({ _id: req.params.id });
        req.user.impersonator = req.user.id;
        req.user.id = req.params.id;
        req.user.db = user;
        res.redirect("/");
    }).catch(_ => { return res.redirect("/staff") });
});


module.exports = router;
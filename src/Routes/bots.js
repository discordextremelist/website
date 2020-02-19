const express = require("express");
const router = express.Router();

const variables = require("../Util/Function/variables.js");
const permission = require("../Util/Function/permissions.js");
const functions = require("../Util/Function/main.js");

router.get("/submit", variables, permission.auth, async (req, res, next) => {
    const libraries = await req.app.db.collection("libraries").find();

    res.render("templates/bots/submit", { 
        title: "Submit Bot", 
        subtitle: "Submit your bot to the list", 
        libraries,
        req 
    });
});

router.post("/submit", variables, permission.auth, async (req, res, next) => {
    const botExists = await req.app.db.collection("bots").find({ id: req.body.id });
    if (botExists) return res.status(400).render("status", { 
        title: "Error", 
        status: 400, 
        message: "This bot has already been added to the list", 
        req 
    }); 

    axios.get(`https://discordapp.com/api/users/${req.body.id}`, { headers: { "Authorization": `Bot ${settings.client.token}` } }).then(async(axRes) => {
        if (req.body.id.length > 32) {
            return res.status(400).render("status", { 
                title: "Error", 
                status: 400, 
                message: "The bot's id cannot be longer than 32 characters", 
                req 
            });
        } else if (axRes.message === "Unknown User") {
            return res.status(400).render("status", { 
                title: "Error", 
                status: 400, 
                message: "There isn't a bot with this id", 
                req 
            });
        } else if (!axRes.bot) {
            return res.status(400).render("status", { 
                title: "Error",
                status: 400, 
                message: "You cannot add users to the bot list", 
                req 
            });
        }

        let invite;

        if (req.body.invite === "") {
            invite = `https://discordapp.com/oauth2/authorize?client_id=${req.body.id}&scope=bot`;
        } else {
            if (typeof req.body.invite !== "string") {
                return res.status(400).render("status", {
                    title: "Error",
                    status: 400,
                    message: "You provided an invalid invite",
                    req
                });
            } else if (req.body.invite.length > 2000) {
                return res.status(400).render("status", {
                    title: "Error",
                    status: 400,
                    message: "The invite link you provided is too long",
                    req
                });
            } else if (!/^https?:\/\//.test(req.body.invite)) {
                return res.status(400).render("status", {
                    title: "Error",
                    status: 400,
                    message: "The invite link must be a valid URL starting with http:// or https://",
                    req
                });
            } else {
                invite = req.body.invite
            }
        }

        if (!req.body.longDescription || req.body.longDescription === '') return res.status(400).render("status", {
            title: "Error",
            status: 400,
            message: "A long description is required",
            req
        });

        let library;
        const dbLibrary = await r.table("libraries").get(req.body.library).run();
        if (!dbLibrary) {
            library = "Other";
        } else {
            library = req.body.library;
        }

        let tags = [];
        if (req.body.fun === "on") tags.push("Fun");
        if (req.body.social === "on") tags.push("Social");
        if (req.body.economy === "on") tags.push("Economy");
        if (req.body.utility === "on") tags.push("Utility");
        if (req.body.moderation === "on") tags.push("Moderation");
        if (req.body.multipurpose === "on") tags.push("Multipurpose");
        if (req.body.music === "on") tags.push("Music");

        let editors;

        if (req.body.editors !== '') {
            editors = [...new Set(req.body.editors.split(/\D+/g))];
        } else {
            editors = [];
        }

        req.app.db.collection("bots").insertOne({
            id: req.body.id,
            name: axRes.username,
            prefix: req.body.prefix,
            library: library,
            tags: tags,
            vanityUrl: "",
            serverCount: 0,
            inviteCount: 0,
            token: "DELAPI_" + crypto.randomBytes(16).toString("hex") + `-${req.body.id}`,
            shortDesc: req.body.shortDescription,
            longDesc: req.body.longDescription,
            modNotes: req.body.modNotes,
            editors: editors,
            owner: {
                id: req.user.id
            },
            avatar: {
                hash: axRes.avatar,
                url: `https://cdn.discordapp.com/avatars/${req.body.id}/${axRes.avatar}`
            },
            votes: {
                positive: [],
                negative: []
            },
            links: {
                invite: req.body.invite,
                support: req.body.supportServer,
                website: req.body.website,
                donation: req.body.donationUrl,
                repo: req.body.repo
            },
            status: {
                approved: false,
                verified: false,
                pendingVerification: false,
                siteBot: false
            }
        });

        r.table("archivedBots").get(req.body.id).delete().run();

        client.channels.get(settings.logs.channels.webLog).send(`${settings.emoji.addBot} **${functions.escapeFormatting(req.user.db.fullUsername)} (${req.user.id})** added bot **${functions.escapeFormatting(axRes.username)} (${req.body.id}) | <@&${settings.roles.staff}>**\n<${settings.website.url}/bots/${req.body.id}>`);

        functions.statusUpdate();
        res.redirect(`/bots/${req.body.id}`);

    });
});

module.exports = router;

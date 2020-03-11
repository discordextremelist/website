const express = require("express");
const snek = require("snekfetch");
const crypto = require("crypto");
const marked = require("marked");
const sanitizeHtml = require("sanitize-html");
const Entities = require("html-entities").AllHtmlEntities;
const entities = new Entities();
const router = express.Router();
 
const settings = require("../../settings.json");
const discord = require("../Util/Services/discord.js");
const variables = require("../Util/Function/variables.js");
const permission = require("../Util/Function/permissions.js");
const functions = require("../Util/Function/main.js");

router.get("/submit", variables, permission.auth, async (req, res, next) => {
    const libraries = await req.app.db.collection("libraries").find().sort({ name: 1 }).toArray();

    res.render("templates/bots/submit", { 
        title: res.__("Submit Bot"), 
        subtitle: res.__("Submit your bot to the list"), 
        libraries,
        req 
    });
});

router.post("/submit", variables, permission.auth, async (req, res, next) => {
    let error = false;
    let errors = [];

    const botExists = await req.app.db.collection("bots").findOne({ id: req.body.id });
    if (botExists) return res.status(409).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("This bot has already been added to the list."),
        status: 409, 
        type: "Error",
        req 
    }); 

    snek.get(`https://discordapp.com/api/users/${req.body.id}`).set("Authorization", `Bot ${settings.client.token}`).then(async(snkRes) => {
        if (req.body.id.length > 32) {
            error = true;
            errors.push(res.__("The bot's id cannot be longer than 32 characters."));
        } else if (snkRes.body.message === "Unknown User") {
            error = true;
            errors.push(res.__("There isn't a bot with this id."));
        } else if (!snkRes.body.bot) {
            error = true;
            errors.push(res.__("You cannot add users to the bot list."));
        }

        let invite;

        if (req.body.invite === "") {
            invite = `https://discordapp.com/oauth2/authorize?client_id=${req.body.id}&scope=bot`;
        } else {
            if (typeof req.body.invite !== "string") {
                error = true;
                errors.push(res.__("You provided an invalid invite."));
            } else if (req.body.invite.length > 2000) {
                error = true;
                errors.push(res.__("The invite link you provided is too long."));
            } else if (!/^https?:\/\//.test(req.body.invite)) {
                error = true;
                errors.push(res.__("The invite link must be a valid URL starting with http:// or https://"));
            } else {
                invite = req.body.invite
            }
        }

        if (!req.body.longDescription || req.body.longDescription === '') {
            error = true;
            errors.push(res.__("A long description is required."));
        }

        let library;
        const dbLibrary = await req.app.db.collection("libraries").findOne({ name: req.body.library });
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

        if (error === true) { 
            const libraries = await req.app.db.collection("libraries").find({ name: { $ne: library } }).sort({ name: 1 }).toArray();
            return res.render("templates/bots/errorOnSubmit", { 
                title: res.__("Submit Bot"), 
                subtitle: res.__("Submit your bot to the list"),
                bot: req.body,
                libraries,
                library,
                req,
                errors,
                tags
            }); 
        }

        let editors;

        if (req.body.editors !== '') {
            editors = [...new Set(req.body.editors.split(/\D+/g))];
        } else {
            editors = [];
        }
        
        req.app.db.collection("bots").insertOne({
            id: req.body.id,
            name: snkRes.body.username,
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
                hash: snkRes.body.avatar,
                url: `https://cdn.discordapp.com/avatars/${req.body.id}/${snkRes.body.avatar}`
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
                siteBot: false,
                archived: false
            }
        });

        discord.bot.createMessage({ channelID: settings.channels.webLog, content: { content: `${settings.emoji.addBot} **${functions.escapeFormatting(req.user.db.fullUsername)} (${req.user.id})** added bot **${functions.escapeFormatting(snkRes.body.username)} (${req.body.id}) | <@&${settings.roles.staff}>**\n<${settings.website.url}/bots/${req.body.id}>` } });

        functions.statusUpdate();
        res.redirect(`/bots/${req.body.id}`);

    }).catch(async(snkRes) => {
        if (req.body.id.length > 32) {
            error = true;
            errors.push(res.__("The bot's id cannot be longer than 32 characters."));
        } else if (snkRes.body.message === "Unknown User") {
            error = true;
            errors.push(res.__("There isn't a bot with this id."));
        } else if (!snkRes.body.bot) {
            error = true;
            errors.push(res.__("You cannot add users to the bot list."));
        }

        if (req.body.invite !== "") {
            if (typeof req.body.invite !== "string") {
                error = true;
                errors.push(res.__("You provided an invalid invite."));
            } else if (req.body.invite.length > 2000) {
                error = true;
                errors.push(res.__("The invite link you provided is too long."));
            } else if (!/^https?:\/\//.test(req.body.invite)) {
            } else {
                invite = req.body.invite
            }
        }

        if (!req.body.longDescription || req.body.longDescription === '') {
            error = true;
            errors.push(res.__("A long description is required."));
        }

        let library;
        const dbLibrary = await req.app.db.collection("libraries").findOne({ name: req.body.library });
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

        const libraries = await req.app.db.collection("libraries").find({ name: { $ne: library } }).sort({ name: 1 }).toArray();
        return res.render("templates/bots/errorOnSubmit", { 
            title: res.__("Submit Bot"), 
            subtitle: res.__("Submit your bot to the list"),
            bot: req.body,
            libraries,
            library,
            req,
            errors,
            tags
        }); 
    });
});

router.get("/:id/edit", variables, permission.auth, async (req, res, next) => {
    const botExists = await req.app.db.collection("bots").findOne({ id: req.params.id });
    if (!botExists) return res.status(404).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("This bot does not exist."),
        status: 404, 
        type: "Error",
        req 
    }); 

    if (botExists.owner.id !== req.user.id && !bot.editors.includes(req.user.id) && req.user.db.mod === false) return res.status(403).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("You do not have the required permission(s) to edit this bot."),
        status: 403, 
        type: "Error",
        req 
    }); 

    const libraries = await req.app.db.collection("libraries").find({ name: { $ne: botExists.library } }).sort({ name: 1 }).toArray();

    res.render("templates/bots/edit", { 
        title: res.__("Edit Bot"), 
        subtitle: res.__("Editing bot: ") + botExists.name,
        libraries,
        bot: botExists,
        editors: botExists.editors ? botExists.editors.join(' ') : '',
        req,
        longDesc: entities.decode(botExists.longDesc)
    });
});

router.post("/:id/edit", variables, permission.auth, async (req, res, next) => {
    let error = false;
    let errors = [];

    const botExists = await req.app.db.collection("bots").findOne({ id: req.params.id });
    
    if (!botExists) return res.status(404).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("This bot does not exist."),
        status: 404, 
        type: "Error",
        req 
    }); 

    const bot = botExists;
    if (bot.owner.id !== req.user.id && !bot.editors.includes(req.user.id) && req.user.db.mod === false) return res.status(403).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("You do not have the required permission(s) to edit this bot."),
        status: 403, 
        type: "Error",
        req 
    }); 

    let invite;

    if (req.body.invite === "") {
        invite = `https://discordapp.com/oauth2/authorize?client_id=${req.body.id}&scope=bot`;
    } else {
        if (typeof req.body.invite !== "string") {
            error = true;
            errors.push(res.__("You provided an invalid invite."));
        } else if (req.body.invite.length > 2000) {
            error = true;
            errors.push(res.__("The invite link you provided is too long."));
        } else if (!/^https?:\/\//.test(req.body.invite)) {
            error = true;
            errors.push(res.__("The invite link must be a valid URL starting with http:// or https://"));
        } else {
            invite = req.body.invite
        }
    }

    if (!req.body.longDescription || req.body.longDescription === '') {
        error = true;
        errors.push(res.__("A long description is required."));
    }

    let library;
    const dbLibrary = await req.app.db.collection("libraries").findOne({ name: req.body.library });
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

    if (error === true) { 
        const libraries = await req.app.db.collection("libraries").find({ name: { $ne: library } }).sort({ name: 1 }).toArray();
        return res.render("templates/bots/errorOnEdit", { 
            title: res.__("Edit Bot"), 
            subtitle: res.__("Editing bot: ") + bot.name,
            bot: req.body,
            libraries,
            library,
            req,
            errors,
            tags
        }); 
    }

    let editors;

    if (req.body.editors !== '') {
        editors = [...new Set(req.body.editors.split(/\D+/g))];
    } else {
        editors = [];
    }

    snek.get(`https://discordapp.com/api/users/${req.params.id}`).set("Authorization", `Bot ${settings.client.token}`).then(async(snkRes) => {
        req.app.db.collection("bots").updateOne({ id: req.params.id }, 
            { $set: {
                name: snkRes.body.username,
                prefix: req.body.prefix,
                library: library,
                tags: tags,
                shortDesc: req.body.shortDescription,
                longDesc: req.body.longDescription,
                editors: editors,
                avatar: {
                    hash: snkRes.body.avatar,
                    url: `https://cdn.discordapp.com/avatars/${req.body.id}/${snkRes.body.avatar}`
                },
                links: {
                    invite: req.body.invite,
                    support: req.body.supportServer,
                    website: req.body.website,
                    donation: req.body.donationUrl,
                    repo: req.body.repo
                }
            }
        });
    }).catch(_ => { return res.status(400).render("status", { title: res.__("Error"), subtitle: res.__("An error occurred when querying the Discord API."), status: 400, type: "Error", req }) });

    discord.bot.createMessage(settings.channels.webLog, `${settings.emoji.editBot} **${functions.escapeFormatting(req.user.db.fullUsername)} (${req.user.id})** edited bot **${functions.escapeFormatting(bot.name)} (${bot.id})**\n<${settings.website.url}/bots/${req.body.id}>`).catch(e => { console.error(e) } );
    res.redirect(`/bots/${req.params.id}`);
});

router.get("/:id", variables, async (req, res, next) => {
    req.botPage = true;
    let bot = await req.app.db.collection("bots").findOne({ id: req.params.id });

    if (!bot) {
        bot = await req.app.db.collection("bots").findOne({ links: { id: req.params.id } })
        const vanity = await r.table("vanityUrls").get(req.params.id).run();

        if (!bot) return res.status(404).render("status", {
            title: res.__("Error"),
            status: 404,
            message: res.__("This bot is not in our database"),
            type: "Error",
            req: req
        });
    }

    var member;
    snek.get(`https://discordapp.com/api/guilds/${settings.guild.main}/members/${bot.id}`).set("Authorization", `Bot ${settings.client.token}`).then(snkRes => {
        member = snkRes;
    }).catch(snkRes => {
        member = snkRes
    });

    const botOwner = await req.app.db.collection("users").findOne({ id: bot.owner.id });
    
    botStatus = await discord.getStatus(bot.id);

    const dirty = await marked(bot.longDesc);
    let clean;
    if (bot.status.verified === true) {
        clean = sanitizeHtml(dirty, {
            allowedTags: [ "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "button", "p", "a", "ul", "ol",
                "nl", "li", "b", "i", "img", "strong", "em", "strike", "code", "hr", "br", "div",
                "table", "thead", "caption", "tbody", "tr", "th", "td", "pre", "iframe", "style", "script", "noscript", "link" ],
            allowedAttributes: false,
        });
    } else {
        clean = sanitizeHtml(dirty, {
            allowedTags: [ "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "button", "p", "a", "ul", "ol",
                "nl", "li", "b", "i", "img", "strong", "em", "strike", "code", "hr", "br", "div",
                "table", "thead", "caption", "tbody", "tr", "th", "td", "pre", "iframe", "style", "link" ],
            allowedAttributes: false,
        });
    }

    res.render("templates/bots/view", {
        title: bot.name,
        subtitle: bot.shortDesc,
        bot: bot,
        longDesc: clean,
        botOwner: botOwner,
        botStatus: botStatus,
        mainServer: settings.guild.main,
        staffServer: settings.guild.staff,
        webUrl: settings.website.url,
        req: req,
        votes: bot.votes.positive.length + -bot.votes.negative.length
    });
});


module.exports = router;

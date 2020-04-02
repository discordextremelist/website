const express = require("express");
const snek = require("snekfetch");
const crypto = require("crypto");
const md = require("markdown-it")();
const Entities = require('html-entities').XmlEntities;
const entities = new Entities();
const sanitizeHtml = require("sanitize-html");
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

        if (!req.body.longDescription) {
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
                invite: invite,
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

        discord.bot.createMessage({ channelID: settings.channels.webLog, content: { content: `${settings.emoji.addBot} **${functions.escapeFormatting(req.user.db.fullUsername)} (${req.user.id})** added bot **${functions.escapeFormatting(snkRes.body.username)} (${req.body.id})\n<${settings.website.url}/bots/${req.body.id}>` } });

        functions.statusUpdate();

        req.app.db.collection("audit").insertOne({
            type: "SUBMIT_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified.",
            details: {
                new: {
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
                        invite: invite,
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
                }
            }
        });

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
                // todo - fix this
            } else {
                invite = req.body.invite
            }
        }

        if (!req.body.longDescription) {
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

router.post("/preview_post", async (req, res, next) => {
    const dirty = entities.decode(md.render(req.body.longDesc)); 

    const clean = sanitizeHtml(dirty, {
        allowedTags: [ "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "button", "p", "a", "ul", "ol",
            "nl", "li", "b", "i", "img", "strong", "em", "strike", "code", "hr", "br", "div",
            "table", "thead", "caption", "tbody", "tr", "th", "td", "pre", "iframe", "style", "link" ],
        allowedAttributes: false,
    });

    res.status(200).send(clean);
});

router.post("/:id/setvanity", variables, permission.auth, async (req, res, next) => {
    const botExists = await req.app.db.collection("bots").findOne({ id: req.params.id });
    if (!botExists) return res.status(404).render("status", {
        title: res.__("Error"),
        subtitle: res.__("This bot does not exist."),
        status: 404,
        type: "Error",
        req
    });

    if (botExists.owner.id !== req.user.id && req.user.db.assistant === false) return res.status(403).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("You do not have the required permission(s) to set/modify this bot's vanity url."),
        status: 403, 
        type: "Error",
        req 
    }); 

    if (botExists.vanityUrl && botExists.owner.id === req.user.id && req.user.db.assistant === false) {
        return res.status(400).render("status", {
            title: res.__("Error"),
            subtitle: res.__("You do not have the required permission(s) to modify your bot's vanity url, please contact an Assistant or higher if you want to change your vanity url."),
            status: 400,
            type: "Error",
            req
        });
    } else if (botExists.vanityUrl && req.user.db.assistant === true) {
        req.app.db.collection("bots").updateOne({ id: req.params.id }, 
            { $set: {
                vanityUrl: req.body.vanity
            }
        });

        req.app.db.collection("audit").insertOne({
            type: "MODIFY_VANITY",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: botExists.vanityUrl,
                new: req.body.vanity
            }
        });

        res.redirect(`/bots/${req.params.id}`);
    } else if (!botExists.vanityUrl) {
        req.app.db.collection("bots").updateOne({ id: req.params.id }, 
            { $set: {
                vanityUrl: req.body.vanity
            }
        });

        req.app.db.collection("audit").insertOne({
            type: "SET_VANITY",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            details: {
                old: "Not available.",
                new: req.body.vanity
            }
        });

        res.redirect(`/bots/${req.params.id}`);
    }
})

router.get("/:id/edit", variables, permission.auth, async (req, res, next) => {
    const botExists = await req.app.db.collection("bots").findOne({ id: req.params.id });
    if (!botExists) return res.status(404).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("This bot does not exist."),
        status: 404, 
        type: "Error",
        req 
    }); 

    if (botExists.owner.id !== req.user.id && !bot.editors.includes(req.user.id) && req.user.db.assistant === false) return res.status(403).render("status", { 
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
        resubmit: false,
        longDesc: botExists.longDesc
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

    if (!req.body.longDescription) {
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
            resubmit: false,
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
                    invite: invite,
                    support: req.body.supportServer,
                    website: req.body.website,
                    donation: req.body.donationUrl,
                    repo: req.body.repo
                }
            }
        });

        req.app.db.collection("audit").insertOne({
            type: "EDIT_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified.",
            details: {
                old: {
                    name: botExists.name,
                    prefix: botExists.prefix,
                    library: botExists.library,
                    tags: botExists.tags,
                    shortDesc: botExists.shortDesc,
                    longDesc: botExists.longDesc,
                    editors: botExists.editors,
                    avatar: {
                        hash: botExists.avatar.hash,
                        url: botExists.avatar.url
                    },
                    links: {
                        invite: botExists.links.invite,
                        support: botExists.links.support,
                        website: botExists.links.website,
                        donation: botExists.links.donation,
                        repo: botExists.links.repo
                    }
                },
                new: {
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
                        invite: invite,
                        support: req.body.supportServer,
                        website: req.body.website,
                        donation: req.body.donationUrl,
                        repo: req.body.repo
                    }
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
        bot = await req.app.db.collection("bots").findOne({ vanityUrl: req.params.id });

        if (!bot) return res.status(404).render("status", {
            title: res.__("Error"),
            status: 404,
            subtitle: res.__("This bot is not in our database"),
            type: "Error",
            req: req
        });
    }

    if (bot.status.archived === true) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("This bot is not in our database"),
        type: "Error",
        req: req
    });

    const botOwner = await req.app.db.collection("users").findOne({ id: bot.owner.id });
    
    botStatus = await discord.getStatus(bot.id);

    const dirty = entities.decode(md.render(bot.longDesc)); 
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

router.get("/:id/upvote", variables, permission.auth, async (req, res, next) => {
    let bot = await req.app.db.collection("bots").findOne({ id: req.params.id });

    if (!bot) {
        bot = await req.app.db.collection("bots").findOne({ vanityUrl: req.params.id });

        if (!bot) return res.status(404).render("status", {
            title: res.__("Error"),
            status: 404,
            subtitle: res.__("This bot is not in our database"),
            type: "Error",
            req: req
        });
    }

    let upVotes = bot.votes.positive;
    let downVotes = bot.votes.negative;

    if (upVotes.includes(req.user.id) || downVotes.includes(req.user.id)) {
        if (upVotes.includes(req.user.id)) {
            let removeUser = upVotes.indexOf(req.user.id);
            while (removeUser > -1) {
                upVotes.splice(removeUser, 1);
                removeUser = upVotes.indexOf(req.user.id);
            }
        }

        if (downVotes.includes(req.user.id)) {
            let removeUser = downVotes.indexOf(req.user.id);
            while (removeUser > -1) {
                downVotes.splice(removeUser, 1);
                removeUser = downVotes.indexOf(req.user.id);
            }

            upVotes.push(req.user.id);
        }
    } else {
        upVotes.push(req.user.id);
    }

    req.app.db.collection("bots").updateOne({ id: bot.id }, 
        { $set: {
            votes: {
                positive: upVotes,
                negative: downVotes
            }
        }
    });

    req.app.db.collection("audit").insertOne({
        type: "UPVOTE_BOT",
        executor: req.user.id,
        target: req.params.id,
        date: Date.now(),
        reason: "None specified.",
        details: {
            old: {
                votes: {
                    positive: bot.votes.positive,
                    negative: bot.votes.negative
                }
            },
            new: {
                votes: {
                    positive: upVotes,
                    negative: downVotes
                }
            }
        }
    });

    res.redirect(`/bots/${bot.id}`);
});

router.get("/:id/downvote", variables, permission.auth, async (req, res, next) => {
    let bot = await req.app.db.collection("bots").findOne({ id: req.params.id });

    if (!bot) {
        bot = await req.app.db.collection("bots").findOne({ vanityUrl: req.params.id });

        if (!bot) return res.status(404).render("status", {
            title: res.__("Error"),
            status: 404,
            subtitle: res.__("This bot is not in our database"),
            type: "Error",
            req: req
        });
    }

    let upVotes = bot.votes.positive;
    let downVotes = bot.votes.negative;

    if (upVotes.includes(req.user.id) || downVotes.includes(req.user.id)) {
        if (upVotes.includes(req.user.id)) {
            let removeUser = upVotes.indexOf(req.user.id);
            while (removeUser > -1) {
                upVotes.splice(removeUser, 1);
                removeUser = upVotes.indexOf(req.user.id);
            }

            downVotes.push(req.user.id);
        }
        if (downVotes.includes(req.user.id)) {
            let removeUser = downVotes.indexOf(req.user.id);
            while (removeUser > -1) {
                downVotes.splice(removeUser, 1);
                removeUser = downVotes.indexOf(req.user.id);
            }
        }
    } else {
        downVotes.push(req.user.id);
    }

    req.app.db.collection("bots").updateOne({ id: bot.id }, 
        { $set: {
            votes: {
                positive: upVotes,
                negative: downVotes
            }
        }
    });

    req.app.db.collection("audit").insertOne({
        type: "DOWNVOTE_BOT",
        executor: req.user.id,
        target: req.params.id,
        date: Date.now(),
        reason: "None specified.",
        details: {
            old: {
                votes: {
                    positive: bot.votes.positive,
                    negative: bot.votes.negative
                }
            },
            new: {
                votes: {
                    positive: upVotes,
                    negative: downVotes
                }
            }
        }
    });

    res.redirect(`/bots/${bot.id}`);
});

router.get("/:id/delete", variables, permission.auth, async (req, res, next) => {
    let bot = await req.app.db.collection("bots").findOne({ id: req.params.id });

    if (!bot) {
        bot = await req.app.db.collection("bots").findOne({ vanityUrl: req.params.id });

        if (!bot) return res.status(404).render("status", {
            title: res.__("Error"),
            status: 404,
            subtitle: res.__("This bot is not in our database"),
            type: "Error",
            req: req
        });
    }

    if (!req.user || req.user.id !== bot.owner.id) return res.status(403).render("status", {
        title: "Error",
        status: 403,
        message: "You cannot perform this action as you are not the owner of the bot",
        user: req.user,
        req: req
    });

    discord.bot.createMessage({ channelID: settings.channels.webLog, content: { content: `${settings.emoji.botDeleted} **${functions.escapeFormatting(req.user.db.fullUsername)} (${req.user.id})** deleted bot **${functions.escapeFormatting(bot.name)} (${bot.id})**` } });

    req.app.db.collection("bots").deleteOne({ id: req.params.id });

    req.app.db.collection("audit").insertOne({
        type: "DELETE_BOT",
        executor: req.user.id,
        target: req.params.id,
        date: Date.now(),
        reason: "None specified."
    });

    functions.statusUpdate()
    res.redirect("/users/@me");
});

router.get("/:id/resubmit", variables, permission.auth, async (req, res, next) => {
    const botExists = await req.app.db.collection("bots").findOne({ id: req.params.id });
    if (!botExists) return res.status(404).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("This bot does not exist."),
        status: 404, 
        type: "Error",
        req 
    }); 

    if (botExists.status.archived === false) return res.status(400).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("You cannot resubmit a bot that isn't archived."),
        status: 400, 
        type: "Error",
        req 
    }); 

    if (botExists.owner.id !== req.user.id && req.user.db.assistant === false) return res.status(403).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("You do not have the required permission(s) to resubmit this bot."),
        status: 403, 
        type: "Error",
        req 
    }); 

    const libraries = await req.app.db.collection("libraries").find({ name: { $ne: botExists.library } }).sort({ name: 1 }).toArray();

    res.render("templates/bots/edit", { 
        title: res.__("Resubmit Bot"), 
        subtitle: res.__("Resubmitting bot: ") + botExists.name,
        libraries,
        bot: botExists,
        editors: botExists.editors ? botExists.editors.join(' ') : '',
        req,
        resubmit: true,
        longDesc: botExists.longDesc
    });
});

router.post("/:id/resubmit", variables, permission.auth, async (req, res, next) => {
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
    if (bot.owner.id !== req.user.id && req.user.db.assistant === false) return res.status(403).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("You do not have the required permission(s) to resubmit this bot."),
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

    if (!req.body.longDescription) {
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
            title: res.__("Resubmit Bot"), 
            subtitle: res.__("Resubmitting bot: ") + bot.name,
            bot: req.body,
            libraries,
            library,
            req,
            resubmit: true,
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
                    invite: invite,
                    support: req.body.supportServer,
                    website: req.body.website,
                    donation: req.body.donationUrl,
                    repo: req.body.repo
                },
                "status.archived": false
            }
        });

        req.app.db.collection("audit").insertOne({
            type: "RESUBMIT_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified.",
            details: {
                old: {
                    name: botExists.name,
                    prefix: botExists.prefix,
                    library: botExists.library,
                    tags: botExists.tags,
                    shortDesc: botExists.shortDesc,
                    longDesc: botExists.longDesc,
                    editors: botExists.editors,
                    avatar: {
                        hash: botExists.avatar.hash,
                        url: botExists.avatar.url
                    },
                    links: {
                        invite: botExists.links.invite,
                        support: botExists.links.support,
                        website: botExists.links.website,
                        donation: botExists.links.donation,
                        repo: botExists.links.repo
                    },
                    status: {
                        archived: true
                    }
                },
                new: {
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
                        invite: invite,
                        support: req.body.supportServer,
                        website: req.body.website,
                        donation: req.body.donationUrl,
                        repo: req.body.repo
                    },
                    status: {
                        archived: false
                    }
                }
            }
        });
    }).catch(_ => { return res.status(400).render("status", { title: res.__("Error"), subtitle: res.__("An error occurred when querying the Discord API."), status: 400, type: "Error", req }) });

    discord.bot.createMessage(settings.channels.webLog, `${settings.emoji.resubmitBot} **${functions.escapeFormatting(req.user.db.fullUsername)} (${req.user.id})** resubmitted bot **${functions.escapeFormatting(bot.name)} (${bot.id})**\n<${settings.website.url}/bots/${req.body.id}>`).catch(e => { console.error(e) } );
    res.redirect(`/bots/${req.params.id}`);
});

router.get("/:id/approve", variables, permission.auth, permission.mod, async (req, res, next) => {
    const bot = await req.app.db.collection("bots").findOne({ id: req.params.id });

    if (!bot) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("You cannot approve a bot that doesn't exist"),
        req,
        type: "Error"
    });

    if (bot.status.approved === true) return res.status(400).render("status", {
        title: res.__("Error"),
        status: 400,
        subtitle: res.__("You cannot approve a bot that is already approved"),
        req,
        type: "Error"
    });

    req.app.db.collection("bots").updateOne({ id: req.params.id }, 
        { $set: {
            "status.approved": true
        }
    });

    discord.bot.createMessage(settings.channels.webLog, `${settings.emoji.check} **${functions.escapeFormatting(req.user.db.fullUsername)} (${req.user.id})** approved bot **${functions.escapeFormatting(bot.name)} (${bot.id})**\n<${settings.website.url}/bots/${bot.id}>`).catch(e => { console.error(e) } );
    
    const dmChannel = await discord.bot.getDMChannel(bot.owner.id);
    if (dmChannel) discord.bot.createMessage(dmChannel.id, `${settings.emoji.check} **|** Your bot **${functions.escapeFormatting(bot.name)}** \`(${bot.id})\` has been approved!`).catch(e => { console.error(e) });
    
    const mainGuild = await discord.bot.guilds.get(settings.guild.main);
    const staffGuild = await discord.bot.guilds.get(settings.guild.staff);
    mainGuild.members.get(bot.owner.id).addRole(settings.roles.developer, "User's bot was just approved.")
        .catch(e => {
            console.error(e);
            discord.bot.createMessage(settings.channels.alerts, `${settings.emoji.error} Failed giving <@${bot.owner.id}> \`${bot.owner.id}\` the role **Bot Developer** upon one of their bots being approved.`);
        });

    mainGuild.members.get(bot.id).addRole(settings.roles.bot, "Bot was approved on the website.")
        .catch(e => {
            console.error(e);
            discord.bot.createMessage(settings.channels.alerts, `${settings.emoji.error} Failed giving <@${bot.id}> \`${bot.id}\` the role **Bot** upon being approved on the website.`);
        });

    staffGuild.members.get(bot.id).kick("Bot was approved on the website.")
        .catch(e => {
            console.error(e);
            discord.bot.createMessage(settings.channels.alerts, `${settings.emoji.error} Failed kicking <@${bot.id}> \`${bot.id}\` from the Staff Server on approval.`);
        });

    req.app.db.collection("audit").insertOne({
        type: "APPROVE_BOT",
        executor: req.user.id,
        target: req.params.id,
        date: Date.now(),
        reason: "None specified."
    });

    res.redirect(`/bots/${req.params.id}`);
});

router.get("/:id/verify", variables, permission.auth, permission.assistant, async (req, res, next) => {
    const bot = await req.app.db.collection("bots").findOne({ id: req.params.id });

    if (!bot) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("You cannot approve a bot that doesn't exist"),
        req,
        type: "Error"
    });

    if (bot.status.verified === true) return res.status(400).render("status", {
        title: res.__("Error"),
        status: 400,
        subtitle: res.__("You cannot verify a bot that is already verified"),
        req,
        type: "Error"
    });

    const mainGuild = await discord.bot.guilds.get(settings.guild.main);
    mainGuild.members.get(bot.owner.id).addRole(settings.roles.verifiedDeveloper, "User's bot was just verified.")
        .catch(e => {
            console.error(e);
            discord.bot.createMessage(settings.channels.alerts, `${settings.emoji.error} Failed giving <@${bot.owner.id}> \`${bot.owner.id}\` the role **Verified Developer** upon one of their bots being verified.`);
        });

        mainGuild.members.get(bot.id).addRole(settings.roles.verifiedBot, "Bot was verified on the website.")
        .catch(e => {
            console.error(e);
            discord.bot.createMessage(settings.channels.alerts, `${settings.emoji.error} Failed giving <@${member.id}> \`${member.id}\` the role **Verified Bot** upon being verified on the website.`);
        });

    req.app.db.collection("bots").updateOne({ id: req.params.id }, 
        { $set: {
            "rank.verified": true
        }
    });

    req.app.db.collection("users").updateOne({ id: bot.owner.id }, 
        { $set: {
            "rank.verified": true
        }
    });

    req.app.db.collection("audit").insertOne({
        type: "VERIFY_BOT",
        executor: req.user.id,
        target: req.params.id,
        date: Date.now(),
        reason: "None specified."
    });

    discord.bot.createMessage(settings.channels.webLog, `${settings.emoji.verified} **${functions.escapeFormatting(req.user.db.fullUsername)} (${req.user.id})** verified bot **${functions.escapeFormatting(bot.name)} (${bot.id})**\n<${settings.website.url}/bots/${req.params.id}>`).catch(e => { console.error(e) } );
    
    const dmChannel = await discord.bot.getDMChannel(bot.owner.id);
    if (dmChannel) discord.bot.createMessage(dmChannel.id, `${settings.emoji.verified} **|** Your bot **${functions.escapeFormatting(bot.name)}** \`(${bot.id})\` was verified!`).catch(e => { console.error(e) });

    res.redirect(`/bots/${req.params.id}`);
});

router.get("/:id/unverify", variables, permission.auth, permission.assistant, async (req, res, next) => {
    const bot = await req.app.db.collection("bots").findOne({ id: req.params.id });

    if (!bot) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("You cannot unverify a bot that doesn't exist"),
        req,
        type: "Error"
    });

    if (bot.status.verified === false) return res.status(400).render("status", {
        title: res.__("Error"),
        status: 400,
        subtitle: res.__("You cannot unverify a bot that is not verified"),
        req,
        type: "Error"
    });

    req.app.db.collection("bots").updateOne({ id: req.params.id }, 
        { $set: {
            "status.verified": false
        }
    });

    req.app.db.collection("audit").insertOne({
        type: "UNVERIFY_BOT",
        executor: req.user.id,
        target: req.params.id,
        date: Date.now(),
        reason: "None specified."
    });

    discord.bot.createMessage(settings.channels.webLog, `${settings.emoji.unverifiedBot} **${functions.escapeFormatting(req.user.db.fullUsername)} (${req.user.id})** unverified bot **${functions.escapeFormatting(bot.name)} (${bot.id})**\n<${settings.website.url}/bots/${req.params.id}>`).catch(e => { console.error(e) } );

    const dmChannel = await discord.bot.getDMChannel(bot.owner.id);
    if (dmChannel) discord.bot.createMessage(dmChannel.id, `${settings.emoji.unverifiedBot} **|** Your bot **${functions.escapeFormatting(bot.name)}** \`(${bot.id})\` has been unverified!?\n\n**For further information please contact a Website Administrator or Assistant.**`).catch(e => { console.error(e) });

    res.redirect(`/bots/${req.params.id}`);
});

router.get("/:id/decline", variables, permission.auth, permission.mod, async (req, res, next) => {
    const bot = await req.app.db.collection("bots").findOne({ id: req.params.id });

    if (!bot) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("You cannot decline a bot that doesn't exist"),
        req,
        type: "Error"
    });

    if (bot.status.approved === true) return res.status(400).render("status", {
        title: res.__("Error"),
        status: 400,
        subtitle: res.__("You cannot decline a bot that is not in the queue"),
        req,
        type: "Error"
    });

    let redirect = `/bots/${bot.id}`;

    if (req.query.from && req.query.from === "queue") redirect = "/staff/queue";

    res.render("templates/bots/staffActions/decline", { title: res.__("Decline Bot"), subtitle: res.__("Declining bot: ") + bot.name, redirect, decliningBot: bot, req });
});

router.post("/:id/decline", variables, permission.auth, permission.mod, async (req, res, next) => {
    const bot = await req.app.db.collection("bots").findOne({ id: req.params.id });

    if (!bot) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("You cannot decline a bot that doesn't exist"),
        req,
        type: "Error"
    });

    if (bot.status.approved === true) return res.status(400).render("status", {
        title: res.__("Error"),
        status: 400,
        subtitle: res.__("You cannot decline a bot that is not in the queue"),
        req,
        type: "Error"
    });

    req.app.db.collection("bots").updateOne({ id: req.params.id }, 
        { $set: {
            vanityUrl: "",
            "status.archived": true
        }
    });

    req.app.db.collection("audit").insertOne({
        type: "DECLINE_BOT",
        executor: req.user.id,
        target: req.params.id,
        date: Date.now(),
        reason: req.body.reason || "None specified."
    });

    discord.bot.createMessage(settings.channels.webLog, `${settings.emoji.cross} **${functions.escapeFormatting(req.user.db.fullUsername)}** \`(${req.user.id})\` declined bot **${functions.escapeFormatting(bot.name)}** \`(${bot.id})\`\n**Reason:** \`${req.body.reason}\``);
    functions.statusUpdate();

    const guild = await discord.bot.guilds.get(settings.guild.staff);
    const member = guild.members.get(req.body.id);

    if (member) {
        await member.kick("Bot's listing has been declined.").catch(e => { console.error(e) });
    }

    const dmChannel = await discord.bot.getDMChannel(bot.owner.id);
    if (dmChannel) discord.bot.createMessage(dmChannel.id, `${settings.emoji.cross} **|** Your bot **${functions.escapeFormatting(bot.name)}** \`(${bot.id})\` has been declined.\n**Reason:** \`${req.body.reason}\``).catch(e => { console.error(e) });

    res.redirect("/staff/queue");
});

router.get("/:id/remove", variables, permission.auth, permission.mod, async (req, res, next) => {
    const bot = await req.app.db.collection("bots").findOne({ id: req.params.id });

    if (!bot) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("You cannot decline a bot that doesn't exist"),
        req,
        type: "Error"
    });
    
    if (bot.status.approved === false) return res.status(400).render("status", {
        title: res.__("Error"),
        status: 400,
        subtitle: res.__("You cannot remove a bot that is in the queue"),
        req,
        type: "Error"
    });

    res.render("templates/bots/staffActions/remove", { 
        title: res.__("Remove Bot"), 
        subtitle: res.__("Removing bot: ") + bot.name,
        removingBot: bot, 
        req 
    });
});

router.post("/:id/remove", variables, permission.auth, permission.mod, async (req, res, next) => {
    const bot = await req.app.db.collection("bots").findOne({ id: req.params.id });

    if (!bot) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("You cannot decline a bot that doesn't exist"),
        req,
        type: "Error"
    });
    
    if (bot.status.approved === false) return res.status(400).render("status", {
        title: res.__("Error"),
        status: 400,
        subtitle: res.__("You cannot remove a bot that is in the queue"),
        req,
        type: "Error"
    });

    req.app.db.collection("bots").updateOne({ id: req.params.id }, 
        { $set: {
            vanityUrl: "",
            "status.archived": true
        }
    });

    req.app.db.collection("audit").insertOne({
        type: "REMOVE_BOT",
        executor: req.user.id,
        target: req.params.id,
        date: Date.now(),
        reason: req.body.reason || "None specified."
    });

    discord.bot.createMessage(settings.channels.webLog, `${settings.emoji.botDeleted} **${functions.escapeFormatting(req.user.db.fullUsername)}** \`(${req.user.id})\` removed bot **${functions.escapeFormatting(bot.name)}** \`(${bot.id})\`\n**Reason:** \`${req.body.reason}\``);
    functions.statusUpdate();

    const guild = await discord.bot.guilds.get(settings.guild.main);
    const member = guild.members.get(req.body.id);

    if (member) {
        await member.kick("Bot has been removed from the website.").catch(e => { console.error(e) });
    }
    
    const dmChannel = await discord.bot.getDMChannel(bot.owner.id);
    if (dmChannel) discord.bot.createMessage(dmChannel.id, `${settings.emoji.botDeleted} **|** Your bot **${functions.escapeFormatting(bot.name)}** \`(${bot.id})\` has been removed!\n**Reason:** \`${req.body.reason}\``).catch(e => { console.error(e) });

    res.redirect("/staff/queue");
});

module.exports = router;

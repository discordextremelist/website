const express = require("express");
const md = require("markdown-it")();
const Entities = require("html-entities").XmlEntities;
const entities = new Entities();
const sanitizeHtml = require("sanitize-html");
const router = express.Router();

const settings = require("../../settings.json");
const variables = require("../Util/Function/variables.js");
const permission = require("../Util/Function/permissions.js");
const functions = require("../Util/Function/main.js");
const discord = require("../Util/Services/discord.js");

router.get("/submit", variables, permission.auth, (req, res, next) => {
    res.render("templates/servers/submit", { 
        title: res.__("Submit Server"), 
        subtitle: res.__("Submit your server to the list"), 
        req 
    });
});

router.post("/submit", variables, permission.auth, async (req, res, next) => {
    let error = false;
    let errors = [];

    const serverExists = await req.app.db.collection("a").findOne({ id: req.body.id });
    if (serverExists) return res.status(409).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("This server has already been added to the list."),
        status: 409, 
        type: "Error",
        req 
    }); 

    function getGuildFromArray(guilds) {
        return guilds.id === req.body.id;
    }

    const serverData = req.user.guilds.find(getGuildFromArray);

    if (req.body.id.length > 32) {
        error = true;
        errors.push(res.__("The server's id cannot be longer than 32 characters."));
    } else if (!serverData) {
        error = true;
        errors.push(res.__("You need to be in the server to add it to the server list."));
    }

    if (!req.body.invite) {
        errors.push(res.__("You didn't provide a valid invite."));
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
        }
    }

    if (!req.body.longDescription) {
        error = true;
        errors.push(res.__("A long description is required."));
    }

    if (error === true) { 
        return res.render("templates/servers/errorOnSubmit", { 
            title: res.__("Submit Server"), 
            subtitle: res.__("Submit your server to the list"),
            server: req.body,
            req,
            errors
        }); 
    }
    
    req.app.db.collection("servers").insertOne({
        id: req.body.id,
        name: serverData.name,
        shortDesc: req.body.shortDescription,
        longDesc: req.body.longDescription,
        owner: {
            id: req.user.id,
        },
        icon: {
            hash: serverData.icon,
            url: `https://cdn.discordapp.com/icons/${req.body.id}/${serverData.icon}`
        },
        links: {
            invite: req.body.invite,
            website: req.body.website,
            donation: req.body.donationUrl
        }
    });

    discord.bot.createMessage(settings.channels.webLog, `${settings.emoji.addBot} **${functions.escapeFormatting(req.user.db.fullUsername)}** \`(${req.user.id})\` added server **${functions.escapeFormatting(serverData.name)}** \`(${req.body.id})\`\n<${settings.website.url}/servers/${req.body.id}>`);

    req.app.db.collection("audit").insertOne({
        type: "SUBMIT_SERVER",
        executor: req.user.id,
        target: req.params.id,
        date: Date.now(),
        reason: "None specified.",
        details: {
            new: {
                id: req.body.id,
                name: serverData.name,
                shortDesc: req.body.shortDescription,
                longDesc: req.body.longDescription,
                owner: {
                    id: req.user.id,
                },
                icon: {
                    hash: serverData.icon,
                    url: `https://cdn.discordapp.com/icons/${req.body.id}/${serverData.icon}`
                },
                links: {
                    invite: req.body.invite,
                    website: req.body.website,
                    donation: req.body.donationUrl
                }
            }
        }
    });

    res.redirect(`/servers/${req.body.id}`);
});

router.get("/:id", variables, async (req, res, next) => {
    req.botPage = true;
    const server = await req.app.db.collection("servers").findOne({ id: req.params.id });

    if (!server) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("This server is not in our database"),
        type: "Error",
        req: req
    });

    const serverOwner = await req.app.db.collection("users").findOne({ id: server.owner.id });

    const dirty = entities.decode(md.render(server.longDesc)); 
    let clean;
    clean = sanitizeHtml(dirty, {
        allowedTags: [ "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "button", "p", "a", "ul", "ol",
            "nl", "li", "b", "i", "img", "strong", "em", "strike", "code", "hr", "br", "div",
            "table", "thead", "caption", "tbody", "tr", "th", "td", "pre" ],
        allowedAttributes: false,
    });

    res.render("templates/servers/view", {
        title: server.name,
        subtitle: server.shortDesc,
        server,
        longDesc: clean,
        serverOwner,
        webUrl: settings.website.url,
        req
    });
});

router.get("/:id/edit", variables, permission.auth, async (req, res, next) => {
    const server = await req.app.db.collection("servers").findOne({ id: req.params.id });

    if (!server) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("This server is not in our database"),
        type: "Error",
        req: req
    });

    if (server.owner.id !== req.user.id && req.user.db.assistant === false) return res.status(403).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("You do not have the required permission(s) to edit this server."),
        status: 403, 
        type: "Error",
        req 
    }); 

    res.render("templates/servers/edit", { 
        title: res.__("Edit Server"), 
        subtitle: res.__("Editing server: " + server.name), 
        req,
        server
    });
});

router.post("/:id/edit", variables, permission.auth, async (req, res, next) => {
    let error = false;
    let errors = [];

    const server = await req.app.db.collection("servers").findOne({ id: req.params.id });

    if (!server) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("This server is not in our database"),
        type: "Error",
        req: req
    });

    if (server.owner.id !== req.user.id && req.user.db.assistant === false) return res.status(403).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("You do not have the required permission(s) to edit this server."),
        status: 403, 
        type: "Error",
        req 
    }); 

    function getGuildFromArray(guilds) {
        return guilds.id === req.params.id;
    }

    const serverData = req.user.guilds.find(getGuildFromArray);

    if (!serverData) {
        error = true;
        errors.push(res.__("You need to be in the server to edit it??"));
    }

    if (!req.body.invite) {
        errors.push(res.__("You didn't provide a valid invite."));
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
        }
    }

    if (!req.body.longDescription) {
        error = true;
        errors.push(res.__("A long description is required."));
    }

    if (error === true) { 
        return res.render("templates/servers/errorOnEdit", { 
            title: res.__("Edit Server"), 
            subtitle: res.__("Editing server: " + server.name),
            server: req.body,
            req,
            errors
        }); 
    }
    
    req.app.db.collection("servers").updateOne({ id: req.params.id }, 
        { $set: {
            name: serverData.name,
            shortDesc: req.body.shortDescription,
            longDesc: req.body.longDescription,
            owner: {
                id: req.user.id,
            },
            icon: {
                hash: serverData.icon,
                url: `https://cdn.discordapp.com/icons/${req.body.id}/${serverData.icon}`
            },
            links: {
                invite: req.body.invite,
                website: req.body.website,
                donation: req.body.donationUrl
            }
        }
    });

    discord.bot.createMessage(settings.channels.webLog, `${settings.emoji.editBot} **${functions.escapeFormatting(req.user.db.fullUsername)}** \`(${req.user.id})\` edited server **${functions.escapeFormatting(serverData.name)}** \`(${req.body.id})\`\n<${settings.website.url}/servers/${req.body.id}>`);

    req.app.db.collection("audit").insertOne({
        type: "EDIT_SERVER",
        executor: req.user.id,
        target: req.params.id,
        date: Date.now(),
        reason: "None specified.",
        details: {
            new: {
                name: serverData.name,
                shortDesc: req.body.shortDescription,
                longDesc: req.body.longDescription,
                owner: {
                    id: req.user.id,
                },
                icon: {
                    hash: serverData.icon,
                    url: `https://cdn.discordapp.com/icons/${req.body.id}/${serverData.icon}`
                },
                links: {
                    invite: req.body.invite,
                    website: req.body.website,
                    donation: req.body.donationUrl
                }
            },
            old: {
                name: server.name,
                shortDesc: server.shortDesc,
                longDesc: server.longDesc,
                owner: {
                    id: server.owner.id,
                },
                icon: {
                    hash: server.icon.hash,
                    url: server.icon.url
                },
                links: {
                    invite: server.links.invite,
                    website: server.links.website,
                    donation: server.links.donationUrl
                }
            }
        }
    });

    res.redirect(`/servers/${req.body.id}`);
});

module.exports = router;

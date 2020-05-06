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
const fetch = require("node-fetch");
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

const serverCache = require("../Util/Services/serverCaching.js");
const userCache = require("../Util/Services/userCaching.js");
const serverUpdate = require("../Util/Services/serverUpdate.js");

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
    
    fetch(`https://discord.com/api/v7/invites/${req.body.invite}`, { method: "GET", headers: { Authorization: `Bot ${settings.client.token}`} }).then(async(fetchRes) => {
        fetchRes.jsonBody = await fetchRes.json();
        
        if (fetchRes.jsonBody.code !== 10006) {
            const serverExists = await req.app.db.collection("servers").findOne({ id: fetchRes.jsonBody.guild.id });
            if (serverExists) return res.status(409).render("status", { 
                title: res.__("Error"), 
                subtitle: res.__("This server has already been added to the list."),
                status: 409, 
                type: "Error",
                req 
            }); 

            if (!req.body.invite) {
                errors.push(res.__("You didn't provide a valid invite."));
            } else {
                if (typeof req.body.invite !== "string") {
                    error = true;
                    errors.push(res.__("You provided an invalid invite."));
                } else if (req.body.invite.length > 2000) {
                    error = true;
                    errors.push(res.__("The invite link you provided is too long."));
                } else if (/^https?:\/\//.test(req.body.invite)) {
                    error = true;
                    errors.push(res.__("The invite code cannot be a URL."));
                } else if (req.body.invite.includes("discord.gg")) {
                    error = true;
                    errors.push(res.__("The invite code cannot contain discord.gg."));
                }
            }
        
            if (!req.body.longDescription) {
                error = true;
                errors.push(res.__("A long description is required."));
            }
        } else {
            error = true;
            errors.push(res.__("You provided an invalid invite."));
        }

        let tags = [];
        if (req.body.gaming === "on") tags.push("Gaming");
        if (req.body.music === "on") tags.push("Music");
        if (req.body.mediaEntertain === "on") tags.push("Media & Entertainment");
        if (req.body.createArts === "on") tags.push("Creative Arts");
        if (req.body.sciTech === "on") tags.push("Science & Tech");
        if (req.body.edu === "on") tags.push("Education");
        if (req.body.fashBeaut === "on") tags.push("Fashion & Beauty");
    
        if (req.body.relIdentity === "on") tags.push("Relationships & Identity");
        if (req.body.travelCuis === "on") tags.push("Travel & Food");
        if (req.body.fitHealth === "on") tags.push("Fitness & Health");
        if (req.body.finance === "on") tags.push("Finance");
    
        if (error === true) { 
            return res.render("templates/servers/errorOnSubmit", { 
                title: res.__("Submit Server"), 
                subtitle: res.__("Submit your server to the list"),
                server: req.body,
                req,
                tags,
                errors
            }); 
        }
        
        await req.app.db.collection("servers").insertOne({
            id: fetchRes.jsonBody.guild.id,
            inviteCode: req.body.invite,
            name: fetchRes.jsonBody.guild.name,
            shortDesc: req.body.shortDescription,
            longDesc: req.body.longDescription,
            tags: tags,
            owner: {
                id: req.user.id,
            },
            icon: {
                hash: fetchRes.jsonBody.guild.icon,
                url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.guild.id}/${fetchRes.jsonBody.guild.icon}`
            },
            links: {
                invite: `https://discord.gg/${req.body.invite}`,
                website: req.body.website,
                donation: req.body.donationUrl
            }
        });

        await discord.bot.createMessage(settings.channels.webLog, `${settings.emoji.addBot} **${functions.escapeFormatting(req.user.db.fullUsername)}** \`(${req.user.id})\` added server **${functions.escapeFormatting(fetchRes.jsonBody.guild.name)}** \`(${fetchRes.jsonBody.guild.id})\`\n<${settings.website.url}/servers/${fetchRes.jsonBody.guild.id}>`);

        await req.app.db.collection("audit").insertOne({
            type: "SUBMIT_SERVER",
            executor: req.user.id,
            date: Date.now(),
            reason: "None specified.",
            details: {
                new: {
                    id: fetchRes.jsonBody.guild.id,
                    inviteCode: req.body.invite,
                    name: fetchRes.jsonBody.guild.name,
                    shortDesc: req.body.shortDescription,
                    longDesc: req.body.longDescription,
                    tags: tags,
                    owner: {
                        id: req.user.id,
                    },
                    icon: {
                        hash: fetchRes.jsonBody.guild.icon,
                        url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.guild.id}/${fetchRes.jsonBody.guild.icon}`
                    },
                    links: {
                        invite: `https://discord.gg/${req.body.invite}`,
                        website: req.body.website,
                        donation: req.body.donationUrl
                    }
                }
            }
        });

        await serverCache.updateServer(fetchRes.jsonBody.guild.id);

        res.redirect(`/servers/${fetchRes.jsonBody.guild.id}`);
    }).catch(async(fetchRes) => {
        console.error(fetchRes);

        if (!req.body.invite) {
            error = true;
            errors.push(res.__("You didn't provide a valid invite."));
        } else {
            if (typeof req.body.invite !== "string") {
                error = true;
                errors.push(res.__("You provided an invalid invite."));
            } else if (req.body.invite.length > 2000) {
                error = true;
                errors.push(res.__("The invite link you provided is too long."));
            } else if (/^https?:\/\//.test(req.body.invite)) {
                error = true;
                errors.push(res.__("The invite code cannot be a URL."));
            } else if (req.body.invite.includes("discord.gg")) {
                error = true;
                errors.push(res.__("The invite code cannot contain discord.gg."));
            }
        }

        if (!req.body.longDescription) {
            error = true;
            errors.push(res.__("A long description is required."));
        }

        let tags = [];
        if (req.body.gaming === "on") tags.push("Gaming");
        if (req.body.music === "on") tags.push("Music");
        if (req.body.mediaEntertain === "on") tags.push("Media & Entertainment");
        if (req.body.createArts === "on") tags.push("Creative Arts");
        if (req.body.sciTech === "on") tags.push("Science & Tech");
        if (req.body.edu === "on") tags.push("Education");
        if (req.body.fashBeaut === "on") tags.push("Fashion & Beauty");

        if (req.body.relIdentity === "on") tags.push("Relationships & Identity");
        if (req.body.travelCuis === "on") tags.push("Travel & Food");
        if (req.body.fitHealth === "on") tags.push("Fitness & Health");
        if (req.body.finance === "on") tags.push("Finance");

        return res.render("templates/servers/errorOnSubmit", { 
            title: res.__("Submit Server"), 
            subtitle: res.__("Submit your server to the list"),
            server: req.body,
            tags,
            req,
            errors
        }); 
    });
});

router.get("/:id", variables, async (req, res, next) => {
    res.locals.pageType = {
        server: true,
        bot: false
    }

    let server = await serverCache.getServer(req.params.id);
    if (!server) {
        server = await req.app.db.collection("servers").findOne({ id: req.params.id });
        if (!server) return res.status(404).render("status", {
            title: res.__("Error"),
            status: 404,
            subtitle: res.__("This server is not in our database"),
            type: "Error",
            req: req,
            pageType: { server: false, bot: false }
        });
    }

    let serverOwner = await userCache.getUser(server.owner.id);
    if (!serverOwner) {
        serverOwner = await req.app.db.collection("users").findOne({ id: server.owner.id });
    }

    const dirty = entities.decode(md.render(server.longDesc)); 
    let clean;
    clean = sanitizeHtml(dirty, {
        allowedTags: [ "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "button", "p", "a", "ul", "ol",
            "nl", "li", "b", "i", "img", "strong", "em", "strike", "code", "hr", "br", "div",
            "table", "thead", "caption", "tbody", "tr", "th", "td", "pre" ],
        allowedAttributes: {
            "a": ["href", "target", "rel"],
            "img": ["src"]
        },
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

    if (!req.body.invite) {
        error = true;
        errors.push(res.__("You didn't provide a valid invite."));
    } else {
        if (typeof req.body.invite !== "string") {
            error = true;
            errors.push(res.__("You provided an invalid invite."));
        } else if (req.body.invite.length > 32) {
            error = true;
            errors.push(res.__("The invite code you provided is too long."));
        } else if (/^https?:\/\//.test(req.body.invite)) {
            error = true;
            errors.push(res.__("The invite code cannot be a URL."));
        } else if (req.body.invite.includes("discord.gg")) {
            error = true;
            errors.push(res.__("The invite code cannot contain discord.gg."));
        }
    }

    if (!req.body.longDescription) {
        error = true;
        errors.push(res.__("A long description is required."));
    }

    let tags = [];
    if (req.body.gaming === "on") tags.push("Gaming");
    if (req.body.music === "on") tags.push("Music");
    if (req.body.mediaEntertain === "on") tags.push("Media & Entertainment");
    if (req.body.createArts === "on") tags.push("Creative Arts");
    if (req.body.sciTech === "on") tags.push("Science & Tech");
    if (req.body.edu === "on") tags.push("Education");
    if (req.body.fashBeaut === "on") tags.push("Fashion & Beauty");

    if (req.body.relIdentity === "on") tags.push("Relationships & Identity");
    if (req.body.travelCuis === "on") tags.push("Travel & Food");
    if (req.body.fitHealth === "on") tags.push("Fitness & Health");
    if (req.body.finance === "on") tags.push("Finance");
    
    fetch(`https://discord.com/api/v6/invites/${req.body.invite}`, { method: "GET", headers: { Authorization: `Bot ${settings.client.token}`} }).then(async(fetchRes) => {
        fetchRes.jsonBody = await fetchRes.json();
        console.log(fetchRes.jsonBody) // this does return shit

        if (fetchRes.jsonBody.guild.id !== server.id) {
            error = true;
            errors.push(res.__("The invite code used must be from the same server as the one used during submission!"))
        }

        if (error === true) { 
            return res.render("templates/servers/errorOnEdit", { 
                title: res.__("Edit Server"), 
                subtitle: res.__("Editing server: " + server.name),
                server: req.body,
                req,
                tags,
                errors
            }); 
        }
        
        await req.app.db.collection("servers").updateOne({ id: req.params.id }, 
            { $set: {
                name: fetchRes.jsonBody.guild.name,
                shortDesc: req.body.shortDescription,
                longDesc: req.body.longDescription,
                inviteCode: req.body.invite,
                tags: tags,
                icon: {
                    hash: fetchRes.jsonBody.guild.icon,
                    url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.guild.id}/${fetchRes.jsonBody.guild.icon}`
                },
                links: {
                    invite: `https://discord.gg/${req.body.invite}`,
                    website: req.body.website,
                    donation: req.body.donationUrl
                }
            }
        });

        discord.bot.createMessage(settings.channels.webLog, `${settings.emoji.editBot} **${functions.escapeFormatting(req.user.db.fullUsername)}** \`(${req.user.id})\` edited server **${functions.escapeFormatting(fetchRes.jsonBody.guild.name)}** \`(${fetchRes.jsonBody.guild.id})\`\n<${settings.website.url}/servers/${fetchRes.jsonBody.guild.id}>`);

        await req.app.db.collection("audit").insertOne({
            type: "EDIT_SERVER",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified.",
            details: {
                new: {
                    name: fetchRes.jsonBody.guild.name,
                    shortDesc: req.body.shortDescription,
                    longDesc: req.body.longDescription,
                    inviteCode: req.body.invite,
                    tags: tags,
                    icon: {
                        hash: fetchRes.jsonBody.guild.icon,
                        url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.guild.id}/${fetchRes.jsonBody.guild.icon}`
                    },
                    links: {
                        invite: `https://discord.gg/${req.body.invite}`,
                        website: req.body.website,
                        donation: req.body.donationUrl
                    }
                },
                old: {
                    name: server.name,
                    shortDesc: server.shortDesc,
                    longDesc: server.longDesc,
                    inviteCode: server.inviteCode,
                    tags: server.tags,
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
        
        await serverUpdate(req.params.id);

        res.redirect(`/servers/${req.params.id}`);
    }).catch(_ => {
        error = true;
        errors.push(res.__("An error occurred when querying the Discord API."));

        return res.render("templates/servers/errorOnEdit", { 
            title: res.__("Edit Server"), 
            subtitle: res.__("Editing server: " + server.name),
            server: req.body,
            req,
            tags,
            errors
        }); 
    });
});

router.get("/:id/delete", variables, permission.auth, async (req, res, next) => {
    const server = await req.app.db.collection("servers").findOne({ id: req.params.id });

    if (!server) return res.status(404).render("status", {
        title: res.__("Error"),
        status: 404,
        subtitle: res.__("This server is not in our database"),
        type: "Error",
        req: req
    });

    if (server.owner.id !== req.user.id) return res.status(403).render("status", { 
        title: res.__("Error"), 
        subtitle: res.__("You do not have the required permission(s) to delete this server."),
        status: 403, 
        type: "Error",
        req 
    }); 

    discord.bot.createMessage(settings.channels.webLog, `${settings.emoji.botDeleted} **${functions.escapeFormatting(req.user.db.fullUsername)} \`(${req.user.id})\`** deleted server **${functions.escapeFormatting(bot.name)} \`(${bot.id})\`**`);

    req.app.db.collection("servers").deleteOne({ id: req.params.id });

    req.app.db.collection("audit").insertOne({
        type: "DELETE_SERVER",
        executor: req.user.id,
        target: req.params.id,
        date: Date.now(),
        reason: "None specified."
    });

    res.redirect("/users/@me");
});

module.exports = router;

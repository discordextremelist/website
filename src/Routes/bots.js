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
const crypto = require("crypto");
const md = require("markdown-it")();
const Entities = require("html-entities").XmlEntities;
const entities = new Entities();
const sanitizeHtml = require("sanitize-html");
const router = express.Router();

const settings = require("../../settings.json");
const discord = require("../Util/Services/discord.js");
const variables = require("../Util/Function/variables.js");
const permission = require("../Util/Function/permissions.js");
const functions = require("../Util/Function/main.js");

const botCache = require("../Util/Services/botCaching.js");
const userCache = require("../Util/Services/userCaching.js");
const libraryCache = require("../Util/Services/libCaching.js");

router.get("/submit", variables, permission.auth, async (req, res, next) => {
    res.locals.premidPageInfo = res.__("premid.bots.submit");

    res.render("templates/bots/submit", {
        title: res.__("common.nav.me.submitBot"),
        subtitle: res.__("common.nav.me.submitBot.subtitle"),
        libraries: libraryCache.getLibs(),
        req
    });
});

router.post("/submit", variables, permission.auth, async (req, res, next) => {
    res.locals.premidPageInfo = res.__("premid.bots.submit");

    let error = false;
    let errors = [];

    const botExists = await req.app.db
        .collection("bots")
        .findOne({ _id: req.body.id });
    if (botExists)
        return res.status(409).render("status", {
            title: res.__("common.error"),
            subtitle: res.__("common.error.bot.conflict"),
            status: 409,
            type: "Error",
            req
        });

    fetch(`https://discord.com/api/v6/users/${req.body.id}`, {
        method: "GET",
        headers: { Authorization: `Bot ${process.ENV.DISCORD_TOKEN}` }
    })
        .then(async (fetchRes) => {
            fetchRes.jsonBody = await fetchRes.json();
            if (req.body.id.length > 32) {
                error = true;
                errors.push(res.__("common.error.bot.arr.idTooLong"));
            } else if (fetchRes.jsonBody.message === "Unknown User") {
                error = true;
                errors.push(res.__("common.error.bot.arr.notFound"));
            } else if (!fetchRes.jsonBody.bot) {
                error = true;
                errors.push(res.__("common.error.bot.arr.isUser"));
            }

            let invite;

            if (req.body.invite === "") {
                invite = `https://discord.com/oauth2/authorize?client_id=${req.body.id}&scope=bot`;
            } else {
                if (typeof req.body.invite !== "string") {
                    error = true;
                    errors.push(
                        res.__("common.error.listing.arr.invite.invalid")
                    );
                } else if (req.body.invite.length > 2000) {
                    error = true;
                    errors.push(
                        res.__("common.error.listing.arr.invite.tooLong")
                    ); //JUMP
                } else if (!/^https?:\/\//.test(req.body.invite)) {
                    error = true;
                    errors.push(
                        res.__("common.error.bot.arr.invite.urlInvalid")
                    );
                } else {
                    invite = req.body.invite;
                }
            }

            if (!req.body.longDescription) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.longDescRequired")
                );
            }

            if (!req.body.prefix) {
                error = true;
                errors.push(res.__("common.error.listing.arr.prefixRequired"));
            }

            const library = libraryCache.hasLib(req.body.library)
                ? req.body.library
                : "Other";
            let tags = [];
            if (req.body.fun === "on") tags.push("Fun");
            if (req.body.social === "on") tags.push("Social");
            if (req.body.economy === "on") tags.push("Economy");
            if (req.body.utility === "on") tags.push("Utility");
            if (req.body.moderation === "on") tags.push("Moderation");
            if (req.body.multipurpose === "on") tags.push("Multipurpose");
            if (req.body.music === "on") tags.push("Music");

            if (error === true) {
                return res.render("templates/bots/errorOnSubmit", {
                    title: res.__("common.nav.me.submitBot"),
                    subtitle: res.__("common.nav.me.submitBot.subtitle"),
                    bot: req.body,
                    libraries: libraryCache.getLibs(),
                    library,
                    req,
                    errors,
                    tags
                });
            }

            let editors;

            if (req.body.editors !== "") {
                editors = [...new Set(req.body.editors.split(/\D+/g))];
            } else {
                editors = [];
            }

            await req.app.db.collection("bots").insertOne({
                _id: req.body.id,
                name: fetchRes.jsonBody.username,
                prefix: req.body.prefix,
                library: library,
                tags: tags,
                vanityUrl: "",
                serverCount: 0,
                shardCount: 0,
                token:
                    "DELAPI_" +
                    crypto.randomBytes(16).toString("hex") +
                    `-${req.body.id}`,
                flags: fetchRes.jsonBody.public_flags,
                shortDesc: req.body.shortDescription,
                longDesc: req.body.longDescription,
                modNotes: req.body.modNotes,
                editors: editors,
                owner: {
                    id: req.user.id
                },
                avatar: {
                    hash: fetchRes.jsonBody.avatar,
                    url: `https://cdn.discordapp.com/avatars/${req.body.id}/${fetchRes.jsonBody.avatar}`
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
                widgetbot: {
                    channel: req.body.widgetChannel,
                    options: req.body.widgetOptions,
                    server: req.body.widgetServer
                },
                status: {
                    approved: false,
                    premium: false,
                    siteBot: false,
                    archived: false
                }
            });

            discord.bot.createMessage(
                settings.channels.webLog,
                `${settings.emoji.addBot} **${functions.escapeFormatting(
                    req.user.db.fullUsername
                )}** \`(${
                    req.user.id
                })\` added bot **${functions.escapeFormatting(
                    fetchRes.jsonBody.username
                )}** \`(${req.body.id})\`\n<${settings.website.url}/bots/${
                    req.body.id
                }>`
            );

            await req.app.db.collection("audit").insertOne({
                type: "SUBMIT_BOT",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: "None specified.",
                details: {
                    new: {
                        _id: req.body.id,
                        name: fetchRes.jsonBody.username,
                        prefix: req.body.prefix,
                        library: library,
                        tags: tags,
                        flags: fetchRes.jsonBody.public_flags,
                        vanityUrl: "",
                        serverCount: 0,
                        shardCount: 0,
                        token:
                            "DELAPI_" +
                            crypto.randomBytes(16).toString("hex") +
                            `-${req.body.id}`,
                        shortDesc: req.body.shortDescription,
                        longDesc: req.body.longDescription,
                        modNotes: req.body.modNotes,
                        editors: editors,
                        owner: {
                            id: req.user.id
                        },
                        avatar: {
                            hash: fetchRes.jsonBody.avatar,
                            url: `https://cdn.discordapp.com/avatars/${req.body.id}/${fetchRes.jsonBody.avatar}`
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
                        widgetbot: {
                            channel: req.body.widgetChannel,
                            options: req.body.widgetOptions,
                            server: req.body.widgetServer
                        },
                        status: {
                            approved: false,
                            premium: false,
                            siteBot: false,
                            archived: false
                        }
                    }
                }
            });
            await botCache.updateBot(req.params.id);
            res.redirect(`/bots/${req.body.id}`);
        })
        .catch(async (fetchRes) => {
            if (req.body.id.length > 32) {
                error = true;
                errors.push(res.__("common.error.bot.arr.idTooLong"));
            }

            if (req.body.invite !== "") {
                if (typeof req.body.invite !== "string") {
                    error = true;
                    errors.push(
                        res.__("common.error.listing.arr.invite.invalid")
                    );
                } else if (req.body.invite.length > 2000) {
                    error = true;
                    errors.push(
                        res.__("common.error.listing.arr.invite.tooLong")
                    );
                } else if (!/^https?:\/\//.test(req.body.invite)) {
                    error = true;
                    errors.push(res.__("Invite needs to be a valid URL."));
                } else {
                    invite = req.body.invite;
                }
            }

            if (!req.body.longDescription) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.longDescRequired")
                );
            }

            if (!req.body.prefix) {
                error = true;
                errors.push(res.__("common.error.listing.arr.prefixRequired"));
            }

            const library = libraryCache.hasLib(req.body.library)
                ? req.body.library
                : "Other";
            let tags = [];
            if (req.body.fun === "on") tags.push("Fun");
            if (req.body.social === "on") tags.push("Social");
            if (req.body.economy === "on") tags.push("Economy");
            if (req.body.utility === "on") tags.push("Utility");
            if (req.body.moderation === "on") tags.push("Moderation");
            if (req.body.multipurpose === "on") tags.push("Multipurpose");
            if (req.body.music === "on") tags.push("Music");
            return res.render("templates/bots/errorOnSubmit", {
                title: res.__("common.nav.me.submitBot"),
                subtitle: res.__("common.nav.me.submitBot.subtitle"),
                bot: req.body,
                libraries: libraryCache.getLibs(),
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
        allowedTags: [
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "blockquote",
            "button",
            "p",
            "a",
            "ul",
            "ol",
            "nl",
            "li",
            "b",
            "i",
            "img",
            "strong",
            "em",
            "strike",
            "code",
            "hr",
            "br",
            "div",
            "table",
            "thead",
            "caption",
            "tbody",
            "tr",
            "th",
            "td",
            "pre",
            "iframe",
            "style",
            "link"
        ],
        allowedAttributes: false,
        allowVulnerableTags: true
    });

    res.status(200).send(clean);
});

router.post(
    "/:id/setvanity",
    variables,
    permission.auth,
    async (req, res, next) => {
        const botExists = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });
        if (!botExists)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.404"),
                status: 404,
                type: "Error",
                req
            });

        if (
            botExists.owner.id !== req.user.id &&
            req.user.db.assistant === false
        )
            return res.status(403).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.perms.vanity"),
                status: 403,
                type: "Error",
                req
            });

        if (
            botExists.vanityUrl &&
            botExists.owner.id === req.user.id &&
            req.user.db.assistant === false
        ) {
            return res.status(400).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.perms.modifyVanity"),
                status: 400,
                type: "Error",
                req
            });
        } else if (botExists.vanityUrl && req.user.db.assistant === true) {
            if (req.body.vanity.split(" ").length !== 1)
                return res.status(400).render("status", {
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.tooLong"),
                    status: 400,
                    type: "Error",
                    req
                });

            await req.app.db.collection("bots").updateOne(
                { _id: req.params.id },
                {
                    $set: {
                        vanityUrl: req.body.vanity
                    }
                }
            );

            await req.app.db.collection("audit").insertOne({
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
            await botCache.updateBot(req.params.id);

            res.redirect(`/bots/${req.params.id}`);
        } else if (!botExists.vanityUrl) {
            if (req.body.vanity.split(" ").length !== 1)
                return res.status(400).render("status", {
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.bot.vanity.tooLong"),
                    status: 400,
                    type: "Error",
                    req
                });

            await req.app.db.collection("bots").updateOne(
                { _id: req.params.id },
                {
                    $set: {
                        vanityUrl: req.body.vanity
                    }
                }
            );

            await req.app.db.collection("audit").insertOne({
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
            await botCache.updateBot(req.params.id);

            res.redirect(`/bots/${req.params.id}`);
        }
    }
);

router.get("/:id/edit", variables, permission.auth, async (req, res, next) => {
    const botExists = await req.app.db
        .collection("bots")
        .findOne({ _id: req.params.id });
    if (!botExists)
        return res.status(404).render("status", {
            title: res.__("common.error"),
            subtitle: res.__("common.error.bot.404"),
            status: 404,
            type: "Error",
            req
        });

    res.locals.premidPageInfo = res.__("premid.bots.edit", botExists.name);

    if (
        botExists.owner.id !== req.user.id &&
        !botExists.editors.includes(req.user.id) &&
        req.user.db.assistant === false
    )
        return res.status(403).render("status", {
            title: res.__("common.error"),
            subtitle: res.__("common.error.bot.perms.edit"),
            status: 403,
            type: "Error",
            req
        });
    res.render("templates/bots/edit", {
        title: res.__("page.bots.edit.title"),
        subtitle: res.__("page.bots.edit.subtitle", botExists.name),
        libraries: libraryCache.getLibs(),
        bot: botExists,
        editors: botExists.editors ? botExists.editors.join(" ") : "",
        req,
        resubmit: false,
        longDesc: botExists.longDesc
    });
});

router.post("/:id/edit", variables, permission.auth, async (req, res, next) => {
    let error = false;
    let errors = [];

    const botExists = await req.app.db
        .collection("bots")
        .findOne({ _id: req.params.id });

    if (!botExists)
        return res.status(404).render("status", {
            title: res.__("common.error"),
            subtitle: res.__("common.error.bot.404"),
            status: 404,
            type: "Error",
            req
        });

    res.locals.premidPageInfo = res.__("premid.bots.edit", botExists.name);

    const bot = botExists;
    if (
        bot.owner.id !== req.user.id &&
        !bot.editors.includes(req.user.id) &&
        req.user.db.mod === false
    )
        return res.status(403).render("status", {
            title: res.__("common.error"),
            subtitle: res.__("common.error.bot.perms.edit"),
            status: 403,
            type: "Error",
            req
        });

    let invite;

    if (req.body.invite === "") {
        invite = `https://discord.com/oauth2/authorize?client_id=${req.body.id}&scope=bot`;
    } else {
        if (typeof req.body.invite !== "string") {
            error = true;
            errors.push(res.__("common.error.listing.arr.invite.invalid"));
        } else if (req.body.invite.length > 2000) {
            error = true;
            errors.push(res.__("common.error.listing.arr.invite.tooLong"));
        } else if (!/^https?:\/\//.test(req.body.invite)) {
            error = true;
            errors.push(res.__("common.error.bot.arr.invite.urlInvalid"));
        } else {
            invite = req.body.invite;
        }
    }

    if (!req.body.longDescription) {
        error = true;
        errors.push(res.__("common.error.listing.arr.longDescRequired"));
    }

    if (!req.body.prefix) {
        error = true;
        errors.push(res.__("common.error.listing.arr.prefixRequired"));
    }

    let library = libraryCache.hasLib(req.body.library)
        ? req.body.library
        : "Other";
    let tags = [];
    if (req.body.fun === "on") tags.push("Fun");
    if (req.body.social === "on") tags.push("Social");
    if (req.body.economy === "on") tags.push("Economy");
    if (req.body.utility === "on") tags.push("Utility");
    if (req.body.moderation === "on") tags.push("Moderation");
    if (req.body.multipurpose === "on") tags.push("Multipurpose");
    if (req.body.music === "on") tags.push("Music");

    if (error === true) {
        req.body.status.premium = botExists.status.premium;

        return res.render("templates/bots/errorOnEdit", {
            title: res.__("page.bots.edit.title"),
            subtitle: res.__("page.bots.edit.subtitle", bot.name),
            bot: req.body,
            libraries: libraryCache.getLibs(),
            library,
            req,
            errors,
            resubmit: false,
            tags
        });
    }

    let editors;

    if (req.body.editors !== "") {
        editors = [...new Set(req.body.editors.split(/\D+/g))];
    } else {
        editors = [];
    }

    fetch(`https://discord.com/api/v6/users/${req.params.id}`, {
        method: "GET",
        headers: { Authorization: `Bot ${process.ENV.DISCORD_TOKEN}` }
    })
        .then(async (fetchRes) => {
            fetchRes.jsonBody = await fetchRes.json();
            await req.app.db.collection("bots").updateOne(
                { _id: req.params.id },
                {
                    $set: {
                        name: fetchRes.jsonBody.username,
                        prefix: req.body.prefix,
                        library: library,
                        tags: tags,
                        flags: fetchRes.jsonBody.public_flags,
                        shortDesc: req.body.shortDescription,
                        longDesc: req.body.longDescription,
                        editors: editors,
                        avatar: {
                            hash: fetchRes.jsonBody.avatar,
                            url: `https://cdn.discordapp.com/avatars/${req.body.id}/${fetchRes.jsonBody.avatar}`
                        },
                        links: {
                            invite: invite,
                            support: req.body.supportServer,
                            website: req.body.website,
                            donation: req.body.donationUrl,
                            repo: req.body.repo
                        },
                        widgetbot: {
                            channel: req.body.widgetChannel,
                            options: req.body.widgetOptions,
                            server: req.body.widgetServer
                        }
                    }
                }
            );

            await req.app.db.collection("audit").insertOne({
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
                        flags: botExists.flags,
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
                        widgetbot: {
                            channel: botExists.widgetbot.channel,
                            options: botExists.widgetbot.options,
                            server: botExists.widgetbot.server
                        }
                    },
                    new: {
                        name: fetchRes.jsonBody.username,
                        prefix: req.body.prefix,
                        library: library,
                        tags: tags,
                        flags: fetchRes.jsonBody.public_flags,
                        shortDesc: req.body.shortDescription,
                        longDesc: req.body.longDescription,
                        editors: editors,
                        avatar: {
                            hash: fetchRes.jsonBody.avatar,
                            url: `https://cdn.discordapp.com/avatars/${req.body.id}/${fetchRes.jsonBody.avatar}`
                        },
                        links: {
                            invite: invite,
                            support: req.body.supportServer,
                            website: req.body.website,
                            donation: req.body.donationUrl,
                            repo: req.body.repo
                        },
                        widgetbot: {
                            channel: req.body.widgetChannel,
                            options: req.body.widgetOptions,
                            server: req.body.widgetServer
                        }
                    }
                }
            });
            await botCache.updateBot(req.params.id);
        })
        .catch((_) => {
            return res
                .status(400)
                .render("status", {
                    title: res.__("common.error"),
                    subtitle: res.__("common.error.dapiFail"),
                    status: 400,
                    type: "Error",
                    req
                });
        });

    discord.bot
        .createMessage(
            settings.channels.webLog,
            `${settings.emoji.editBot} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${req.user.id})\` edited bot **${functions.escapeFormatting(
                bot.name
            )}** \`(${bot._id})\`\n<${settings.website.url}/bots/${
                req.body.id
            }>`
        )
        .catch((e) => {
            console.error(e);
        });
    res.redirect(`/bots/${req.params.id}`);
});

router.get("/:id", variables, async (req, res, next) => {
    res.locals.pageType = {
        server: false,
        bot: true,
        template: false
    };

    let bot = await botCache.getBot(req.params.id);
    if (!bot) {
        bot = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });
        if (!bot) {
            bot = await req.app.db
                .collection("bots")
                .findOne({ vanityUrl: req.params.id });
            if (!bot)
                return res.status(404).render("status", {
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
                    type: "Error",
                    req: req,
                    pageType: { server: false, bot: false }
                });
        }
    }

    res.locals.premidPageInfo = res.__("premid.bots.view", bot.name);

    if (bot.status.archived === true)
        return res.status(404).render("status", {
            title: res.__("common.error"),
            status: 404,
            subtitle: res.__("common.error.bot.404"),
            type: "Error",
            req: req,
            pageType: { server: false, bot: false }
        });

    let botOwner = await userCache.getUser(bot.owner.id);
    if (!botOwner) {
        botOwner = await req.app.db
            .collection("users")
            .findOne({ _id: bot.owner.id });
    }

    botStatus = await discord.getStatus(bot._id);

    const dirty = entities.decode(md.render(bot.longDesc));
    let clean;
    if (bot.status.premium === true) {
        clean = sanitizeHtml(dirty, {
            allowedTags: [
                "h1",
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
                "blockquote",
                "button",
                "p",
                "a",
                "ul",
                "ol",
                "nl",
                "li",
                "b",
                "i",
                "img",
                "strong",
                "em",
                "strike",
                "code",
                "hr",
                "br",
                "div",
                "table",
                "thead",
                "caption",
                "tbody",
                "tr",
                "th",
                "td",
                "pre",
                "iframe",
                "style",
                "script",
                "noscript",
                "link"
            ],
            allowedAttributes: false,
            allowVulnerableTags: true
        });
    } else {
        clean = sanitizeHtml(dirty, {
            allowedTags: [
                "h1",
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
                "blockquote",
                "button",
                "p",
                "a",
                "ul",
                "ol",
                "nl",
                "li",
                "b",
                "i",
                "img",
                "strong",
                "em",
                "strike",
                "code",
                "hr",
                "br",
                "div",
                "table",
                "thead",
                "caption",
                "tbody",
                "tr",
                "th",
                "td",
                "pre",
                "iframe",
                "style",
                "link"
            ],
            allowedAttributes: false,
            allowVulnerableTags: true
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
        votes: bot.votes.positive.length - bot.votes.negative.length
    });
});

router.get(
    "/:id/upvote",
    variables,
    permission.auth,
    async (req, res, next) => {
        let bot = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot) {
            bot = await req.app.db
                .collection("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
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

        await req.app.db.collection("bots").updateOne(
            { _id: bot._id },
            {
                $set: {
                    votes: {
                        positive: upVotes,
                        negative: downVotes
                    }
                }
            }
        );

        await botCache.updateBot(bot._id);

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

        res.redirect(`/bots/${bot._id}`);
    }
);

router.get(
    "/:id/downvote",
    variables,
    permission.auth,
    async (req, res, next) => {
        let bot = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot) {
            bot = await req.app.db
                .collection("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
                    type: "Error",
                    req: req
                });
        }

        let upVotes = bot.votes.positive;
        let downVotes = bot.votes.negative;

        if (upVotes.includes(req.user.id) || downVotes.includes(req.user.id)) {
            if (downVotes.includes(req.user.id)) {
                let removeUser = downVotes.indexOf(req.user.id);
                while (removeUser > -1) {
                    downVotes.splice(removeUser, 1);
                    removeUser = downVotes.indexOf(req.user.id);
                }
            }

            if (upVotes.includes(req.user.id)) {
                let removeUser = upVotes.indexOf(req.user.id);
                while (removeUser > -1) {
                    upVotes.splice(removeUser, 1);
                    removeUser = upVotes.indexOf(req.user.id);
                }

                downVotes.push(req.user.id);
            }
        } else {
            downVotes.push(req.user.id);
        }

        await req.app.db.collection("bots").updateOne(
            { _id: bot._id },
            {
                $set: {
                    votes: {
                        positive: upVotes,
                        negative: downVotes
                    }
                }
            }
        );

        await botCache.updateBot(bot._id);

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

        res.redirect(`/bots/${bot._id}`);
    }
);

router.get(
    "/:id/delete",
    variables,
    permission.auth,
    async (req, res, next) => {
        let bot = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot) {
            bot = await req.app.db
                .collection("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return res.status(404).render("status", {
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.bot.404"),
                    type: "Error",
                    req: req
                });
        }

        if (!req.user || req.user.id !== bot.owner.id)
            return res.status(403).render("status", {
                title: "Error",
                status: 403,
                message: res.__("common.error.bot.perms.notOwner"),
                user: req.user,
                req: req
            });

        discord.bot.createMessage(
            settings.channels.webLog,
            `${settings.emoji.botDeleted} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` deleted bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\``
        );

        await req.app.db.collection("bots").deleteOne({ _id: req.params.id });

        await req.app.db.collection("audit").insertOne({
            type: "DELETE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.deleteBot(req.params.id);

        res.redirect("/users/@me");
    }
);

router.get(
    "/:id/resubmit",
    variables,
    permission.auth,
    async (req, res, next) => {
        const botExists = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });
        if (!botExists)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.404"),
                status: 404,
                type: "Error",
                req
            });

        if (botExists.status.archived === false)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                subtitle: res.__(
                    "You cannot resubmit a bot that isn't archived."
                ),
                status: 400,
                type: "Error",
                req
            });

        if (
            botExists.owner.id !== req.user.id &&
            req.user.db.assistant === false
        )
            return res.status(403).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.perms.resubmit"),
                status: 403,
                type: "Error",
                req
            });

        res.locals.premidPageInfo = res.__(
            "premid.bots.resubmit",
            botExists.name
        );

        res.render("templates/bots/edit", {
            title: res.__("page.bots.resubmit.title"),
            subtitle: res.__("page.bots.resubmit.subtitle", botExists.name),
            libraries: libraryCache.getLibs(),
            bot: botExists,
            editors: botExists.editors ? botExists.editors.join(" ") : "",
            req,
            resubmit: true,
            longDesc: botExists.longDesc
        });
    }
);

router.post(
    "/:id/resubmit",
    variables,
    permission.auth,
    async (req, res, next) => {
        let error = false;
        let errors = [];

        const botExists = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!botExists)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.404"),
                status: 404,
                type: "Error",
                req
            });

        const bot = botExists;
        if (bot.owner.id !== req.user.id && req.user.db.assistant === false)
            return res.status(403).render("status", {
                title: res.__("common.error"),
                subtitle: res.__("common.error.bot.perms.resubmit"),
                status: 403,
                type: "Error",
                req
            });

        res.locals.premidPageInfo = res.__(
            "premid.bots.resubmit",
            botExists.name
        );

        let invite;

        if (req.body.invite === "") {
            invite = `https://discord.com/oauth2/authorize?client_id=${req.body.id}&scope=bot`;
        } else {
            if (typeof req.body.invite !== "string") {
                error = true;
                errors.push(res.__("common.error.listing.arr.invite.invalid"));
            } else if (req.body.invite.length > 2000) {
                error = true;
                errors.push(res.__("common.error.listing.arr.invite.tooLong"));
            } else if (!/^https?:\/\//.test(req.body.invite)) {
                error = true;
                errors.push(res.__("common.error.bot.arr.invite.urlInvalid"));
            } else {
                invite = req.body.invite;
            }
        }

        if (!req.body.longDescription) {
            error = true;
            errors.push(res.__("common.error.listing.arr.longDescRequired"));
        }

        if (!req.body.prefix) {
            error = true;
            errors.push(res.__("common.error.listing.arr.prefixRequired"));
        }

        const library = libraryCache.hasLib(req.body.library)
            ? req.body.library
            : "Other";
        let tags = [];
        if (req.body.fun === "on") tags.push("Fun");
        if (req.body.social === "on") tags.push("Social");
        if (req.body.economy === "on") tags.push("Economy");
        if (req.body.utility === "on") tags.push("Utility");
        if (req.body.moderation === "on") tags.push("Moderation");
        if (req.body.multipurpose === "on") tags.push("Multipurpose");
        if (req.body.music === "on") tags.push("Music");

        if (error === true) {
            return res.render("templates/bots/errorOnEdit", {
                title: res.__("page.bots.resubmit.title"),
                subtitle: res.__("page.bots.resubmit.subtitle", bot.name),
                bot: req.body,
                libraries: libraryCache.getLibs(),
                library,
                req,
                resubmit: true,
                errors,
                tags
            });
        }

        let editors;

        if (req.body.editors !== "") {
            editors = [...new Set(req.body.editors.split(/\D+/g))];
        } else {
            editors = [];
        }

        fetch(`https://discord.com/api/v6/users/${req.params.id}`, {
            method: "GET",
            headers: { Authorization: `Bot ${process.ENV.DISCORD_TOKEN}` }
        })
            .then(async (fetchRes) => {
                fetchRes.jsonBody = await fetchRes.json();
                await req.app.db.collection("bots").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            name: fetchRes.jsonBody.username,
                            prefix: req.body.prefix,
                            library: library,
                            tags: tags,
                            flags: fetchRes.jsonBody.public_flags,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            editors: editors,
                            avatar: {
                                hash: fetchRes.jsonBody.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.body.id}/${fetchRes.jsonBody.avatar}`
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
                    }
                );

                await req.app.db.collection("audit").insertOne({
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
                            flags: botExists.flags,
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
                            widgetbot: {
                                channel: botExists.widgetbot.channel,
                                options: botExists.widgetbot.options,
                                server: botExists.widgetbot.server
                            },
                            status: {
                                archived: true
                            }
                        },
                        new: {
                            name: fetchRes.jsonBody.username,
                            prefix: req.body.prefix,
                            library: library,
                            tags: tags,
                            flags: fetchRes.jsonBody.public_flags,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            editors: editors,
                            avatar: {
                                hash: fetchRes.jsonBody.avatar,
                                url: `https://cdn.discordapp.com/avatars/${req.body.id}/${fetchRes.jsonBody.avatar}`
                            },
                            links: {
                                invite: invite,
                                support: req.body.supportServer,
                                website: req.body.website,
                                donation: req.body.donationUrl,
                                repo: req.body.repo
                            },
                            widgetbot: {
                                channel: req.body.widgetChannel,
                                options: req.body.widgetOptions,
                                server: req.body.widgetServer
                            },
                            status: {
                                archived: false
                            }
                        }
                    }
                });
                await botCache.updateBot(req.params.id);
            })
            .catch((_) => {
                return res
                    .status(400)
                    .render("status", {
                        title: res.__("common.error"),
                        subtitle: res.__("common.error.dapiFail"),
                        status: 400,
                        type: "Error",
                        req
                    });
            });

        discord.bot
            .createMessage(
                settings.channels.webLog,
                `${settings.emoji.resubmitBot} **${functions.escapeFormatting(
                    req.user.db.fullUsername
                )}** \`(${
                    req.user.id
                })\` resubmitted bot **${functions.escapeFormatting(
                    bot.name
                )}** \`(${bot._id})\`\n<${settings.website.url}/bots/${
                    req.body.id
                }>`
            )
            .catch((e) => {
                console.error(e);
            });
        res.redirect(`/bots/${req.params.id}`);
    }
);

router.get(
    "/:id/approve",
    variables,
    permission.auth,
    permission.mod,
    async (req, res, next) => {
        const bot = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.bot.error.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === true)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.alreadyApproved"),
                req,
                type: "Error"
            });

        await req.app.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.approved": true
                }
            }
        );

        await req.app.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    "staffTracking.handledBots.allTime.total": (req.user.db.staffTracking.handledBots.allTime.total += 1),
                    "staffTracking.handledBots.allTime.approved": (req.user.db.staffTracking.handledBots.allTime.approved += 1),
                    "staffTracking.handledBots.thisWeek.total": (req.user.db.staffTracking.handledBots.thisWeek.total += 1),
                    "staffTracking.handledBots.thisWeek.approved": (req.user.db.staffTracking.handledBots.thisWeek.approved += 1)
                }
            }
        );

        discord.bot
            .createMessage(
                settings.channels.webLog,
                `${settings.emoji.check} **${functions.escapeFormatting(
                    req.user.db.fullUsername
                )}** \`(${
                    req.user.id
                })\` approved bot **${functions.escapeFormatting(
                    bot.name
                )}** \`(${bot._id})\`\n<${settings.website.url}/bots/${
                    bot._id
                }>`
            )
            .catch((e) => {
                console.error(e);
            });

        const dmChannel = await discord.bot.getDMChannel(bot.owner.id);
        if (dmChannel)
            discord.bot
                .createMessage(
                    dmChannel.id,
                    `${
                        settings.emoji.check
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been approved!`
                )
                .catch((e) => {
                    console.error(e);
                });

        const mainGuild = await discord.bot.guilds.get(settings.guild.main);
        const staffGuild = await discord.bot.guilds.get(settings.guild.staff);

        const mainGuildOwner = mainGuild.members.get(bot.owner.id);
        if (mainGuildOwner)
            mainGuildOwner
                .addRole(
                    settings.roles.developer,
                    "User's bot was just approved."
                )
                .catch((e) => {
                    console.error(e);
                    discord.bot.createMessage(
                        settings.channels.alerts,
                        `${settings.emoji.error} Failed giving <@${bot.owner.id}> \`${bot.owner.id}\` the role **Bot Developer** upon one of their bots being approved.`
                    );
                });

        const mainGuildBot = mainGuild.members.get(bot._id);
        if (mainGuildBot)
            mainGuildBot
                .addRole(settings.roles.bot, "Bot was approved on the website.")
                .catch((e) => {
                    console.error(e);
                    discord.bot.createMessage(
                        settings.channels.alerts,
                        `${settings.emoji.error} Failed giving <@${bot._id}> \`${bot._id}\` the role **Bot** upon being approved on the website.`
                    );
                });

        const botStaffServer = staffGuild.members.get(bot._id);
        if (botStaffServer)
            botStaffServer
                .kick("Bot was approved on the website.")
                .catch((e) => {
                    console.error(e);
                    discord.bot.createMessage(
                        settings.channels.alerts,
                        `${settings.emoji.error} Failed kicking <@${bot._id}> \`${bot._id}\` from the Staff Server on approval.`
                    );
                });

        req.app.db.collection("audit").insertOne({
            type: "APPROVE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await botCache.updateBot(req.params.id);

        res.redirect(`/bots/${req.params.id}`);
    }
);

router.get(
    "/:id/give-premium",
    variables,
    permission.auth,
    permission.assistant,
    async (req, res, next) => {
        const bot = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.bot.error.404"),
                req,
                type: "Error"
            });

        if (bot.status.premium === true)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.alreadyPremium"),
                req,
                type: "Error"
            });

        const mainGuild = await discord.bot.guilds.get(settings.guild.main);
        const botMember = await mainGuild.members.get(bot._id);

        if (botMember)
            botMember
                .addRole(
                    settings.roles.premiumBot,
                    "Bot was given premium on the website."
                )
                .catch((e) => {
                    console.error(e);
                    discord.bot.createMessage(
                        settings.channels.alerts,
                        `${settings.emoji.error} Failed giving <@${member.id}> \`${member.id}\` the role **Premium Bot** upon being given premium on the website.`
                    );
                });

        await req.app.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.premium": true
                }
            }
        );

        await req.app.db.collection("users").updateOne(
            { _id: bot.owner.id },
            {
                $set: {
                    "status.premium": true
                }
            }
        );

        await botCache.updateBot(req.params.id);

        req.app.db.collection("audit").insertOne({
            type: "PREMIUM_BOT_GIVE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        res.redirect(`/bots/${req.params.id}`);
    }
);

router.get(
    "/:id/take-premium",
    variables,
    permission.auth,
    permission.assistant,
    async (req, res, next) => {
        const bot = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.verified === false)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.noPremiumTake"),
                req,
                type: "Error"
            });

        req.app.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    "status.premium": false
                }
            }
        );

        await botCache.updateBot(req.params.id);

        req.app.db.collection("audit").insertOne({
            type: "PREMIUM_BOT_TAKE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        res.redirect(`/bots/${req.params.id}`);
    }
);

router.get(
    "/:id/decline",
    variables,
    permission.auth,
    permission.mod,
    async (req, res, next) => {
        const bot = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__("premid.bots.decline", bot.name);

        if (bot.status.approved === true)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.notInQueue"),
                req,
                type: "Error"
            });

        let redirect = `/bots/${bot._id}`;

        if (req.query.from && req.query.from === "queue")
            redirect = "/staff/queue";

        res.render("templates/bots/staffActions/decline", {
            title: res.__("page.bots.decline.title"),
            subtitle: res.__("page.bots.decline.subtitle", bot.name),
            redirect,
            decliningBot: bot,
            req
        });
    }
);

router.post(
    "/:id/decline",
    variables,
    permission.auth,
    permission.mod,
    async (req, res, next) => {
        const bot = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === true)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.notInQueue"),
                req,
                type: "Error"
            });

        await req.app.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    vanityUrl: "",
                    "status.archived": true
                }
            }
        );

        await req.app.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    "staffTracking.handledBots.allTime.total": (req.user.db.staffTracking.handledBots.allTime.total += 1),
                    "staffTracking.handledBots.allTime.declined": (req.user.db.staffTracking.handledBots.allTime.declined += 1),
                    "staffTracking.handledBots.thisWeek.total": (req.user.db.staffTracking.handledBots.thisWeek.total += 1),
                    "staffTracking.handledBots.thisWeek.declined": (req.user.db.staffTracking.handledBots.thisWeek.declined += 1)
                }
            }
        );

        await req.app.db.collection("audit").insertOne({
            type: "DECLINE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified."
        });

        await botCache.deleteBot(req.params.id);

        discord.bot.createMessage(
            settings.channels.webLog,
            `${settings.emoji.cross} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` declined bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\`\n**Reason:** \`${req.body.reason}\``
        );

        const guild = await discord.bot.guilds.get(settings.guild.staff);
        const member = guild.members.get(req.body.id);

        if (member) {
            await member.kick("Bot's listing has been declined.").catch((e) => {
                console.error(e);
            });
        }

        const dmChannel = await discord.bot.getDMChannel(bot.owner.id);
        if (dmChannel)
            discord.bot
                .createMessage(
                    dmChannel.id,
                    `${
                        settings.emoji.cross
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been declined.\n**Reason:** \`${
                        req.body.reason
                    }\``
                )
                .catch((e) => {
                    console.error(e);
                });

        res.redirect("/staff/queue");
    }
);

router.get(
    "/:id/remove",
    variables,
    permission.auth,
    permission.mod,
    async (req, res, next) => {
        const bot = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === false)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueue"),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__("premid.bots.remove", bot.name);

        res.render("templates/bots/staffActions/remove", {
            title: res.__("page.bots.remove.title"),
            subtitle: res.__("page.bots.remove.subtitle", bot.name),
            removingBot: bot,
            req
        });
    }
);

router.post(
    "/:id/remove",
    variables,
    permission.auth,
    permission.mod,
    async (req, res, next) => {
        const bot = await req.app.db
            .collection("bots")
            .findOne({ _id: req.params.id });

        if (!bot)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.bot.404"),
                req,
                type: "Error"
            });

        if (bot.status.approved === false)
            return res.status(400).render("status", {
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.bot.inQueue"),
                req,
                type: "Error"
            });

        await req.app.db.collection("bots").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    vanityUrl: "",
                    "status.archived": true
                }
            }
        );

        await req.app.db.collection("users").updateOne(
            { _id: req.user.id },
            {
                $set: {
                    "staffTracking.handledBots.allTime.total": (req.user.db.staffTracking.handledBots.allTime.total += 1),
                    "staffTracking.handledBots.allTime.remove": (req.user.db.staffTracking.handledBots.allTime.remove += 1),
                    "staffTracking.handledBots.thisWeek.total": (req.user.db.staffTracking.handledBots.thisWeek.total += 1),
                    "staffTracking.handledBots.thisWeek.remove": (req.user.db.staffTracking.handledBots.thisWeek.remove += 1)
                }
            }
        );

        await req.app.db.collection("audit").insertOne({
            type: "REMOVE_BOT",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified."
        });

        await botCache.deleteBot(req.params.id);

        discord.bot.createMessage(
            settings.channels.webLog,
            `${settings.emoji.botDeleted} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` removed bot **${functions.escapeFormatting(bot.name)}** \`(${
                bot._id
            })\`\n**Reason:** \`${req.body.reason}\``
        );

        const guild = await discord.bot.guilds.get(settings.guild.main);
        const member = guild.members.get(req.body.id);

        if (member) {
            await member
                .kick("Bot has been removed from the website.")
                .catch((e) => {
                    console.error(e);
                });
        }

        const dmChannel = await discord.bot.getDMChannel(bot.owner.id);
        if (dmChannel)
            discord.bot
                .createMessage(
                    dmChannel.id,
                    `${
                        settings.emoji.botDeleted
                    } **|** Your bot **${functions.escapeFormatting(
                        bot.name
                    )}** \`(${bot._id})\` has been removed!\n**Reason:** \`${
                        req.body.reason
                    }\``
                )
                .catch((e) => {
                    console.error(e);
                });

        res.redirect("/staff/queue");
    }
);

module.exports = router;

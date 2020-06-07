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

const userCache = require("../Util/Services/userCaching.js");
const templateCache = require("../Util/Services/templateCaching.js");

router.get("/submit", variables, permission.auth, (req, res, next) => {
    res.locals.premidPageInfo = res.__("premid.templates.submit");

    res.render("templates/serverTemplates/submit", {
        title: res.__("common.nav.me.submitTemplate"),
        subtitle: res.__("common.nav.me.submitTemplate.subtitle"),
        req
    });
});

router.post("/submit", variables, permission.auth, async (req, res, next) => {
    res.locals.premidPageInfo = res.__("premid.templates.submit");

    let error = false;
    let errors = [];

    fetch(`https://discord.com/api/guilds/templates/${req.body.code}`, {
        method: "GET",
        headers: { Authorization: `Bot ${settings.client.token}` }
    })
        .then(async (fetchRes) => {
            fetchRes.jsonBody = await fetchRes.json();

            if (fetchRes.jsonBody.code !== 10057) {
                const templateExists = await req.app.db
                    .collection("templates")
                    .findOne({ _id: fetchRes.jsonBody.code });
                if (templateExists)
                    return res.status(409).render("status", {
                        title: res.__("common.error"),
                        subtitle: res.__("common.error.template.conflict"),
                        status: 409,
                        type: "Error",
                        req
                    });

                if (!req.body.longDescription) {
                    error = true;
                    errors.push(
                        res.__("common.error.listing.arr.longDescRequired")
                    );
                }
            } else {
                error = true;
                errors.push(res.__("common.error.template.arr.invite.invalid"));
            }

            let tags = [];
            if (req.body.gaming === "on") tags.push("Gaming");
            if (req.body.music === "on") tags.push("Music");
            if (req.body.mediaEntertain === "on")
                tags.push("Media & Entertainment");
            if (req.body.createArts === "on") tags.push("Creative Arts");
            if (req.body.sciTech === "on") tags.push("Science & Tech");
            if (req.body.edu === "on") tags.push("Education");
            if (req.body.fashBeaut === "on") tags.push("Fashion & Beauty");

            if (req.body.relIdentity === "on")
                tags.push("Relationships & Identity");
            if (req.body.travelCuis === "on") tags.push("Travel & Food");
            if (req.body.fitHealth === "on") tags.push("Fitness & Health");
            if (req.body.finance === "on") tags.push("Finance");

            if (error === true) {
                return res.render("templates/serverTemplates/errorOnSubmit", {
                    title: res.__("common.nav.me.submitTemplate"),
                    subtitle: res.__("common.nav.me.submitTemplate.subtitle"),
                    template: req.body,
                    tags,
                    req,
                    errors
                });
            }

            await req.app.db.collection("templates").insertOne({
                _id: fetchRes.jsonBody.code,
                name: fetchRes.jsonBody.name,
                region: fetchRes.jsonBody.serialized_source_guild.region,
                locale:
                    fetchRes.jsonBody.serialized_source_guild.preferred_locale,
                afkTimeout:
                    fetchRes.jsonBody.serialized_source_guild.afk_timeout,
                verificationLevel:
                    fetchRes.jsonBody.serialized_source_guild
                        .verification_level,
                defaultMessageNotifications:
                    fetchRes.jsonBody.serialized_source_guild
                        .default_message_notifications,
                explicitContent:
                    fetchRes.jsonBody.serialized_source_guild
                        .explicit_content_filter,
                roles: fetchRes.jsonBody.serialized_source_guild.roles,
                channels: fetchRes.jsonBody.serialized_source_guild.channels,
                usageCount: fetchRes.jsonBody.usage_count,
                shortDesc: req.body.shortDescription,
                longDesc: req.body.longDescription,
                tags: tags,
                fromGuild: fetchRes.jsonBody.source_guild_id,
                owner: {
                    id: req.user.id
                },
                icon: {
                    hash: fetchRes.jsonBody.serialized_source_guild.icon_hash,
                    url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.source_guild_id}/${fetchRes.jsonBody.serialized_source_guild.icon_hash}`
                },
                links: {
                    linkToServerPage: false,
                    template: `https://discord.new/${fetchRes.jsonBody.code}`
                }
            });

            await discord.bot.createMessage(
                settings.channels.webLog,
                `${settings.emoji.addBot} **${functions.escapeFormatting(
                    req.user.db.fullUsername
                )}** \`(${
                    req.user.id
                })\` added template **${functions.escapeFormatting(
                    fetchRes.jsonBody.name
                )}** \`(${fetchRes.jsonBody.code})\`\n<${
                    settings.website.url
                }/templates/${fetchRes.jsonBody.code}>`
            );

            await req.app.db.collection("audit").insertOne({
                type: "SUBMIT_TEMPLATE",
                executor: req.user.id,
                date: Date.now(),
                reason: "None specified.",
                details: {
                    new: {
                        _id: fetchRes.jsonBody.code,
                        name: fetchRes.jsonBody.name,
                        region:
                            fetchRes.jsonBody.serialized_source_guild.region,
                        locale:
                            fetchRes.jsonBody.serialized_source_guild
                                .preferred_locale,
                        afkTimeout:
                            fetchRes.jsonBody.serialized_source_guild
                                .afk_timeout,
                        verificationLevel:
                            fetchRes.jsonBody.serialized_source_guild
                                .verification_level,
                        defaultMessageNotifications:
                            fetchRes.jsonBody.serialized_source_guild
                                .default_message_notifications,
                        explicitContent:
                            fetchRes.jsonBody.serialized_source_guild
                                .explicit_content_filter,
                        roles: fetchRes.jsonBody.serialized_source_guild.roles,
                        channels:
                            fetchRes.jsonBody.serialized_source_guild.channels,
                        usageCount: fetchRes.jsonBody.usage_count,
                        shortDesc: req.body.shortDescription,
                        longDesc: req.body.longDescription,
                        tags: tags,
                        fromGuild: fetchRes.jsonBody.source_guild_id,
                        owner: {
                            id: req.user.id
                        },
                        icon: {
                            hash:
                                fetchRes.jsonBody.serialized_source_guild
                                    .icon_hash,
                            url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.source_guild_id}/${fetchRes.jsonBody.serialized_source_guild.icon_hash}`
                        },
                        links: {
                            linkToServerPage: false,
                            template: `https://discord.new/${fetchRes.jsonBody.code}`
                        }
                    }
                }
            });

            await templateCache.updateTemplate(fetchRes.jsonBody.code);

            res.redirect(`/templates/${fetchRes.jsonBody.code}`);
        })
        .catch(async (fetchRes) => {
            console.error(fetchRes);

            if (!req.body.code) {
                error = true;
                errors.push(res.__("common.error.template.arr.invite.invalid"));
            } else {
                if (typeof req.body.code !== "string") {
                    error = true;
                    errors.push(
                        res.__("common.error.template.arr.invite.invalid")
                    );
                } else if (req.body.code.length > 2000) {
                    error = true;
                    errors.push(
                        res.__("common.error.template.arr.invite.tooLong")
                    );
                } else if (/^https?:\/\//.test(req.body.code)) {
                    error = true;
                    errors.push(
                        res.__("common.error.template.arr.invite.isURL")
                    );
                } else if (req.body.code.includes("discord.new")) {
                    error = true;
                    errors.push(
                        res.__("common.error.template.arr.invite.dnew.")
                    );
                }
            }

            if (!req.body.longDescription) {
                error = true;
                errors.push(
                    res.__("common.error.listing.arr.longDescRequired")
                );
            }

            let tags = [];
            if (req.body.gaming === "on") tags.push("Gaming");
            if (req.body.music === "on") tags.push("Music");
            if (req.body.mediaEntertain === "on")
                tags.push("Media & Entertainment");
            if (req.body.createArts === "on") tags.push("Creative Arts");
            if (req.body.sciTech === "on") tags.push("Science & Tech");
            if (req.body.edu === "on") tags.push("Education");
            if (req.body.fashBeaut === "on") tags.push("Fashion & Beauty");

            if (req.body.relIdentity === "on")
                tags.push("Relationships & Identity");
            if (req.body.travelCuis === "on") tags.push("Travel & Food");
            if (req.body.fitHealth === "on") tags.push("Fitness & Health");
            if (req.body.finance === "on") tags.push("Finance");

            return res.render("templates/serverTemplates/errorOnSubmit", {
                title: res.__("common.nav.me.submitTemplate"),
                subtitle: res.__("common.nav.me.submitTemplate.subtitle"),
                template: req.body,
                tags,
                req,
                errors
            });
        });
});

router.get("/:id", variables, async (req, res, next) => {
    res.locals.pageType = {
        server: false,
        bot: false,
        template: true
    };

    let template = await templateCache.getTemplate(req.params.id);
    if (!template) {
        template = await req.app.db
            .collection("templates")
            .findOne({ _id: req.params.id });
        if (!template)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.template.404"),
                type: "Error",
                req: req,
                pageType: { template: false, bot: false, server: false }
            });
    }

    res.locals.premidPageInfo = res.__("premid.templates.view", template.name);

    let templateOwner = await userCache.getUser(template.owner.id);
    if (!templateOwner) {
        templateOwner = await req.app.db
            .collection("users")
            .findOne({ _id: template.owner.id });
    }

    const dirty = entities.decode(md.render(template.longDesc));
    let clean;
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
            "pre"
        ],
        allowedAttributes: {
            a: ["href", "target", "rel"],
            img: ["src"]
        }
    });

    res.render("templates/serverTemplates/view", {
        title: template.name,
        subtitle: template.shortDesc,
        template,
        longDesc: clean,
        templateOwner,
        webUrl: settings.website.url,
        req,
        functions
    });
});

router.get("/:id/edit", variables, permission.auth, async (req, res, next) => {
    const template = await req.app.db
        .collection("templates")
        .findOne({ _id: req.params.id });

    if (!template)
        return res.status(404).render("status", {
            title: res.__("common.error"),
            status: 404,
            subtitle: res.__("common.error.template.404"),
            type: "Error",
            req: req
        });

    if (template.owner.id !== req.user.id && req.user.db.assistant === false)
        return res.status(403).render("status", {
            title: res.__("common.error"),
            subtitle: res.__("common.error.template.perms.edit"),
            status: 403,
            type: "Error",
            req
        });

    res.locals.premidPageInfo = res.__("premid.templates.edit", template.name);

    res.render("templates/serverTemplates/edit", {
        title: res.__("page.templates.edit.title"),
        subtitle: res.__("page.templates.edit.subtitle", template.name),
        req,
        template
    });
});

router.post("/:id/edit", variables, permission.auth, async (req, res, next) => {
    let error = false;
    let errors = [];

    const template = await req.app.db
        .collection("templates")
        .findOne({ _id: req.params.id });

    if (!template)
        return res.status(404).render("status", {
            title: res.__("common.error"),
            status: 404,
            subtitle: res.__("common.error.template.404"),
            type: "Error",
            req: req
        });

    if (template.owner.id !== req.user.id && req.user.db.assistant === false)
        return res.status(403).render("status", {
            title: res.__("common.error"),
            subtitle: res.__("common.error.template.perms.edit"),
            status: 403,
            type: "Error",
            req
        });

    res.locals.premidPageInfo = res.__("premid.templates.edit", template.name);

    if (!req.body.code) {
        error = true;
        errors.push(res.__("common.error.template.arr.invite.invalid"));
    } else {
        if (typeof req.body.code !== "string") {
            error = true;
            errors.push(res.__("common.error.template.arr.invite.invalid"));
        } else if (req.body.code.length > 2000) {
            error = true;
            errors.push(res.__("common.error.template.arr.invite.tooLong"));
        } else if (/^https?:\/\//.test(req.body.code)) {
            error = true;
            errors.push(res.__("common.error.template.arr.invite.isURL"));
        } else if (req.body.code.includes("discord.new")) {
            error = true;
            errors.push(res.__("common.error.template.arr.invite.dnew."));
        }
    }

    if (!req.body.longDescription) {
        error = true;
        errors.push(res.__("common.error.listing.arr.longDescRequired"));
    }

    let linkToServerPage = false;
    if (req.body.ltsp === "on") linkToServerPage = true;

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

    fetch(`https://discord.com/api/guilds/templates/${req.body.code}`, {
        method: "GET",
        headers: { Authorization: `Bot ${settings.client.token}` }
    })
        .then(async (fetchRes) => {
            fetchRes.jsonBody = await fetchRes.json();

            if (error === true) {
                return res.render("templates/serverTemplates/errorOnEdit", {
                    title: res.__("page.templates.edit.title"),
                    subtitle: res.__(
                        "page.templates.edit.subtitle",
                        server.name
                    ),
                    template: req.body,
                    req,
                    tags,
                    errors
                });
            }

            await req.app.db.collection("templates").updateOne(
                { _id: req.params.id },
                {
                    $set: {
                        name: fetchRes.jsonBody.name,
                        region:
                            fetchRes.jsonBody.serialized_source_guild.region,
                        locale:
                            fetchRes.jsonBody.serialized_source_guild
                                .preferred_locale,
                        afkTimeout:
                            fetchRes.jsonBody.serialized_source_guild
                                .afk_timeout,
                        verificationLevel:
                            fetchRes.jsonBody.serialized_source_guild
                                .verification_level,
                        defaultMessageNotifications:
                            fetchRes.jsonBody.serialized_source_guild
                                .default_message_notifications,
                        explicitContent:
                            fetchRes.jsonBody.serialized_source_guild
                                .explicit_content_filter,
                        roles: fetchRes.jsonBody.serialized_source_guild.roles,
                        channels:
                            fetchRes.jsonBody.serialized_source_guild.channels,
                        usageCount: fetchRes.jsonBody.usage_count,
                        shortDesc: req.body.shortDescription,
                        longDesc: req.body.longDescription,
                        tags: tags,
                        owner: {
                            id: req.user.id
                        },
                        icon: {
                            hash:
                                fetchRes.jsonBody.serialized_source_guild
                                    .icon_hash,
                            url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.source_guild_id}/${fetchRes.jsonBody.serialized_source_guild.icon_hash}`
                        },
                        links: {
                            linkToServerPage: linkToServerPage,
                            template: `https://discord.new/${template._id}`
                        }
                    }
                }
            );

            await discord.bot.createMessage(
                settings.channels.webLog,
                `${settings.emoji.editBot} **${functions.escapeFormatting(
                    req.user.db.fullUsername
                )}** \`(${
                    req.user.id
                })\` edited template **${functions.escapeFormatting(
                    fetchRes.jsonBody.name
                )}** \`(${fetchRes.jsonBody.code})\`\n<${
                    settings.website.url
                }/templates/${fetchRes.jsonBody.code}>`
            );

            await req.app.db.collection("audit").insertOne({
                type: "EDIT_TEMPLATE",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: "None specified.",
                details: {
                    new: {
                        name: fetchRes.jsonBody.name,
                        region:
                            fetchRes.jsonBody.serialized_source_guild.region,
                        locale:
                            fetchRes.jsonBody.serialized_source_guild
                                .preferred_locale,
                        afkTimeout:
                            fetchRes.jsonBody.serialized_source_guild
                                .afk_timeout,
                        verificationLevel:
                            fetchRes.jsonBody.serialized_source_guild
                                .verification_level,
                        defaultMessageNotifications:
                            fetchRes.jsonBody.serialized_source_guild
                                .default_message_notifications,
                        explicitContent:
                            fetchRes.jsonBody.serialized_source_guild
                                .explicit_content_filter,
                        roles: fetchRes.jsonBody.serialized_source_guild.roles,
                        channels:
                            fetchRes.jsonBody.serialized_source_guild.channels,
                        usageCount: fetchRes.jsonBody.usage_count,
                        shortDesc: req.body.shortDescription,
                        longDesc: req.body.longDescription,
                        tags: tags,
                        fromGuild: template.fromGuild,
                        owner: {
                            id: req.user.id
                        },
                        icon: {
                            hash:
                                fetchRes.jsonBody.serialized_source_guild
                                    .icon_hash,
                            url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.source_guild_id}/${fetchRes.jsonBody.serialized_source_guild.icon_hash}`
                        },
                        links: {
                            linkToServerPage: linkToServerPage,
                            template: `https://discord.new/${template._id}`
                        }
                    },
                    old: {
                        name: template.name,
                        region: template.region,
                        locale: template.locale,
                        afkTimeout: template.afkTimeout,
                        verificationLevel: template.verificationLevel,
                        defaultMessageNotifications:
                            template.defaultMessageNotifications,
                        explicitContent: template.explicitContent,
                        roles: template.roles,
                        channels: template.chanmels,
                        usageCount: template.usageCount,
                        shortDesc: template.shortDesc,
                        longDesc: template.longDesc,
                        tags: template.tags,
                        fromGuild: template.fromGuild,
                        owner: {
                            id: template.owner.id
                        },
                        icon: {
                            hash: template.icon.hash,
                            url: `https://cdn.discordapp.com/icons/${template.fromGuild}/${template.icon.hash}`
                        },
                        links: {
                            linkToServerPage: linkToServerPage,
                            template: `https://discord.new/${template._id}`
                        }
                    }
                }
            });

            await templateCache.updateTemplate(req.params.id);

            res.redirect(`/templates/${req.params.id}`);
        })
        .catch((_) => {
            error = true;
            errors.push(res.__("common.error.dapiFail"));

            return res.render("templates/serverTemplates/errorOnEdit", {
                title: res.__("page.templates.edit.title"),
                subtitle: res.__("page.templates.edit.subtitle", template.name),
                template: req.body,
                req,
                tags,
                errors
            });
        });
});

router.get(
    "/:id/delete",
    variables,
    permission.auth,
    async (req, res, next) => {
        const template = await req.app.db
            .collection("templates")
            .findOne({ _id: req.params.id });

        if (!template)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.template.404"),
                type: "Error",
                req: req
            });

        if (template.owner.id !== req.user.id)
            return res.status(403).render("status", {
                title: res.__("common.error"),
                subtitle: res.__(
                    "You do not have the required permission(s) to delete this template."
                ),
                status: 403,
                type: "Error",
                req
            });

        discord.bot.createMessage(
            settings.channels.webLog,
            `${settings.emoji.botDeleted} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` deleted template **${functions.escapeFormatting(
                template.name
            )}** \`(${template._id})\``
        );

        await req.app.db
            .collection("templates")
            .deleteOne({ _id: req.params.id });

        await req.app.db.collection("audit").insertOne({
            type: "DELETE_TEMPLATE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await templateCache.deleteTemplate(req.params.id);

        res.redirect("/users/@me");
    }
);

router.get(
    "/:id/remove",
    variables,
    permission.auth,
    permission.mod,
    async (req, res, next) => {
        const template = await req.app.db
            .collection("templates")
            .findOne({ _id: req.params.id });

        if (!template)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.template.404t"),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__(
            "premid.templates.remove",
            template.name
        );

        res.render("templates/serverTemplates/staffActions/remove", {
            title: res.__("page.servers.remove.title"),
            subtitle: res.__("page.servers.remove.subtitle", server.name),
            removingTemplate: template,
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
        const template = await req.app.db
            .collection("templates")
            .findOne({ _id: req.params.id });

        if (!template)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.template.404t"),
                req,
                type: "Error"
            });

        await req.app.db
            .collection("templates")
            .deleteOne({ _id: req.params.id });

        await req.app.db.collection("audit").insertOne({
            type: "REMOVE_TEMPLATE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified."
        });
        await templateCache.deleteTemplate(req.params.id);

        discord.bot.createMessage(
            settings.channels.webLog,
            `${settings.emoji.botDeleted} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` removed template **${functions.escapeFormatting(
                template.name
            )}** \`(${template._id})\`\n**Reason:** \`${req.body.reason}\``
        );

        const dmChannel = await discord.bot.getDMChannel(bot.owner.id);
        if (dmChannel)
            discord.bot
                .createMessage(
                    dmChannel.id,
                    `${
                        settings.emoji.botDeleted
                    } **|** Your template **${functions.escapeFormatting(
                        template.name
                    )}** \`(${
                        template._id
                    })\` has been removed!\n**Reason:** \`${req.body.reason}\``
                )
                .catch((e) => {
                    console.error(e);
                });

        res.redirect("/staff/queue");
    }
);

router.get(
    "/:id/sync",
    variables,
    permission.auth,
    permission.mod,
    async (req, res, next) => {
        const template = await req.app.db
            .collection("templates")
            .findOne({ _id: req.params.id });

        if (!template)
            return res.status(404).render("status", {
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.template.404"),
                req,
                type: "Error"
            });

        fetch(`https://discord.com/api/guilds/templates/${req.body.code}`, {
            method: "GET",
            headers: { Authorization: `Bot ${settings.client.token}` }
        })
            .then(async (fetchRes) => {
                fetchRes.jsonBody = await fetchRes.json();

                await req.app.db.collection("templates").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            name: fetchRes.jsonBody.name,
                            region:
                                fetchRes.jsonBody.serialized_source_guild
                                    .region,
                            locale:
                                fetchRes.jsonBody.serialized_source_guild
                                    .preferred_locale,
                            afkTimeout:
                                fetchRes.jsonBody.serialized_source_guild
                                    .afk_timeout,
                            verificationLevel:
                                fetchRes.jsonBody.serialized_source_guild
                                    .verification_level,
                            defaultMessageNotifications:
                                fetchRes.jsonBody.serialized_source_guild
                                    .default_message_notifications,
                            explicitContent:
                                fetchRes.jsonBody.serialized_source_guild
                                    .explicit_content_filter,
                            roles:
                                fetchRes.jsonBody.serialized_source_guild.roles,
                            channels:
                                fetchRes.jsonBody.serialized_source_guild
                                    .channels,
                            usageCount: fetchRes.jsonBody.usage_count,
                            icon: {
                                hash:
                                    fetchRes.jsonBody.serialized_source_guild
                                        .icon_hash,
                                url: `https://cdn.discordapp.com/icons/${fetchRes.jsonBody.source_guild_id}/${fetchRes.jsonBody.serialized_source_guild.icon_hash}`
                            }
                        }
                    }
                );

                await req.app.db.collection("audit").insertOne({
                    type: "SYNC_TEMPLATE",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: {
                            name: fetchRes.jsonBody.name,
                            region:
                                fetchRes.jsonBody.serialized_source_guild
                                    .region,
                            locale:
                                fetchRes.jsonBody.serialized_source_guild
                                    .preferred_locale,
                            afkTimeout:
                                fetchRes.jsonBody.serialized_source_guild
                                    .afk_timeout,
                            verificationLevel:
                                fetchRes.jsonBody.serialized_source_guild
                                    .verification_level,
                            defaultMessageNotifications:
                                fetchRes.jsonBody.serialized_source_guild
                                    .default_message_notifications,
                            explicitContent:
                                fetchRes.jsonBody.serialized_source_guild
                                    .explicit_content_filter,
                            roles:
                                fetchRes.jsonBody.serialized_source_guild.roles,
                            channels:
                                fetchRes.jsonBody.serialized_source_guild
                                    .channels,
                            usageCount: fetchRes.jsonBody.usage_count
                        },
                        old: {
                            name: template.name,
                            region: template.region,
                            locale: template.locale,
                            afkTimeout: template.afkTimeout,
                            verificationLevel: template.verificationLevel,
                            defaultMessageNotifications:
                                template.defaultMessageNotifications,
                            explicitContent: template.explicitContent,
                            roles: template.roles,
                            channels: template.chanmels,
                            usageCount: template.usageCount
                        }
                    }
                });

                await templateCache.updateTemplate(req.params.id);
            })
            .catch((_) => {
                return res.status(404).render("status", {
                    title: res.__("common.error"),
                    status: 404,
                    subtitle: res.__("common.error.dapiFail"),
                    req,
                    type: "Error"
                });
            });

        res.redirect(`/templates/${req.params.id}`);
    }
);

module.exports = router;

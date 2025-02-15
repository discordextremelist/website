/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020-2025 Carolina Mitchell, John Burke, Advaith Jagathesan

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
import type { Request, Response } from "express";

import sanitizeHtml from "sanitize-html";

import settings from "../../settings.json" with { type: "json" };
import htmlRef from "../../htmlReference.json" with { type: "json" };
import * as discord from "../Util/Services/discord.js";
import * as permission from "../Util/Function/permissions.js";
import * as functions from "../Util/Function/main.js";
import * as userCache from "../Util/Services/userCaching.js";
import * as templateCache from "../Util/Services/templateCaching.js";
import { variables } from "../Util/Function/variables.js";
import * as tokenManager from "../Util/Services/adminTokenManager.js";
import type { APITemplate, DiscordAPIError } from "discord.js";
import { EmbedBuilder, RESTJSONErrorCodes, Routes } from "discord.js";
import type { templateReasons } from "../../@types/enums.js";
import mdi from "markdown-it";
import entities from "html-entities";
const md = new mdi();
const router = express.Router();

function templateType(bodyType: string): number {
    let type: templateReasons = parseInt(bodyType);

    if (type > 3) type = 0;

    return type;
}

router.get(
    "/submit",
    variables,
    permission.auth,
    (req: Request, res: Response) => {
        res.locals.premidPageInfo = res.__("premid.templates.submit");

        res.render("templates/serverTemplates/submit", {
            title: res.__("common.nav.me.submitTemplate"),
            subtitle: res.__("common.nav.me.submitTemplate.subtitle"),
            req
        });
    }
);

router.post(
    "/submit",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        res.locals.premidPageInfo = res.__("premid.templates.submit");

        let error = false;
        let errors: string[] = [];

        if (
            !req.body.code ||
            typeof req.body.code !== "string" ||
            req.body.code.includes(" ")
        ) {
            error = true;
            errors.push(res.__("common.error.template.arr.invite.invalid"));
        }

        if (req.body.code.length > 2000) {
            error = true;
            errors.push(res.__("common.error.template.arr.invite.tooLong"));
        }

        if (functions.isURL(req.body.code)) {
            error = true;
            errors.push(res.__("common.error.template.arr.invite.isURL"));
        }

        if (req.body.code.includes("discord.new")) {
            error = true;
            errors.push(res.__("common.error.template.arr.invite.dnew"));
        }

        const templateExists: delTemplate | undefined = await global.db
            .collection<delTemplate>("templates")
            .findOne({ _id: req.body.code });
        if (templateExists)
            return res.status(409).json({
                error: true,
                status: 409,
                errors: [res.__("common.error.template.conflict")]
            });

        if (!req.body.shortDescription) {
            error = true;
            errors.push(res.__("common.error.listing.arr.shortDescRequired"));
        } else if (req.body.shortDescription.length > 200) {
            error = true;
            errors.push(res.__("common.error.listing.arr.shortDescTooLong"));
        }

        let tags: string[] = [];

        if (req.body.gaming === true) tags.push("Gaming");
        if (req.body.music === true) tags.push("Music");
        if (req.body.mediaEntertain === true)
            tags.push("Media & Entertainment");
        if (req.body.createArts === true) tags.push("Creative Arts");
        if (req.body.sciTech === true) tags.push("Science & Tech");
        if (req.body.edu === true) tags.push("Education");
        if (req.body.fashBeaut === true) tags.push("Fashion & Beauty");

        if (req.body.relIdentity === true)
            tags.push("Relationships & Identity");
        if (req.body.travelCuis === true) tags.push("Travel & Food");
        if (req.body.fitHealth === true) tags.push("Fitness & Health");
        if (req.body.finance === true) tags.push("Finance");

        if (error === true)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });

        await discord.bot.rest
            .get(Routes.template(req.body.code))
            .then(async (template: APITemplate) => {
                await global.db.collection<delTemplate>("templates").insertOne({
                    _id: template.code,
                    name: template.name,
                    region: template.serialized_source_guild.region,
                    locale: template.serialized_source_guild.preferred_locale,
                    afkTimeout: template.serialized_source_guild.afk_timeout,
                    verificationLevel:
                        template.serialized_source_guild.verification_level,
                    defaultMessageNotifications:
                        template.serialized_source_guild
                            .default_message_notifications,
                    explicitContent:
                        template.serialized_source_guild
                            .explicit_content_filter,
                    roles: template.serialized_source_guild.roles.map((c) => {
                        return { name: c.name, color: c.color };
                    }),
                    channels: template.serialized_source_guild.channels.map(
                        (c) => {
                            return { name: c.name, type: c.type, nsfw: c.nsfw };
                        }
                    ),
                    usageCount: template.usage_count,
                    shortDesc: req.body.shortDescription,
                    longDesc: req.body.longDescription,
                    tags: tags,
                    fromGuild: template.source_guild_id,
                    owner: {
                        id: req.user.id
                    },
                    creator: {
                        id: template.creator.id,
                        username: template.creator.username,
                        discriminator: template.creator.discriminator
                    },
                    icon: {
                        hash: template.serialized_source_guild.icon_hash,
                        url: `https://cdn.discordapp.com/icons/${template.source_guild_id}/${template.serialized_source_guild.icon_hash}`
                    },
                    links: {
                        linkToServerPage: false,
                        template: `https://discord.new/${template.code}`
                    }
                } satisfies delTemplate);

                await discord.channels.logs.send(
                    `${settings.emoji.add} **${functions.escapeFormatting(
                        req.user.db.fullUsername
                    )}** \`(${
                        req.user.id
                    })\` added template **${functions.escapeFormatting(
                        template.name
                    )}** \`(${template.code})\`\n<${
                        settings.website.url
                    }/templates/${template.code}>`
                );

                await global.db.collection("audit").insertOne({
                    type: "SUBMIT_TEMPLATE",
                    executor: req.user.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: {
                            _id: template.code,
                            name: template.name,
                            region: template.serialized_source_guild.region,
                            locale: template.serialized_source_guild
                                .preferred_locale,
                            afkTimeout:
                                template.serialized_source_guild.afk_timeout,
                            verificationLevel:
                                template.serialized_source_guild
                                    .verification_level,
                            defaultMessageNotifications:
                                template.serialized_source_guild
                                    .default_message_notifications,
                            explicitContent:
                                template.serialized_source_guild
                                    .explicit_content_filter,
                            roles: template.serialized_source_guild.roles.map(
                                (c) => {
                                    return { name: c.name, color: c.color };
                                }
                            ),
                            channels:
                                template.serialized_source_guild.channels.map(
                                    (c) => {
                                        return {
                                            name: c.name,
                                            type: c.type,
                                            nsfw: c.nsfw
                                        };
                                    }
                                ),
                            usageCount: template.usage_count,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            tags: tags,
                            fromGuild: template.source_guild_id,
                            owner: {
                                id: req.user.id
                            },
                            creator: {
                                id: template.creator.id,
                                username: template.creator.username,
                                discriminator: template.creator.discriminator
                            },
                            icon: {
                                hash: template.serialized_source_guild
                                    .icon_hash,
                                url: `https://cdn.discordapp.com/icons/${template.source_guild_id}/${template.serialized_source_guild.icon_hash}`
                            },
                            links: {
                                linkToServerPage: false,
                                template: `https://discord.new/${template.code}`
                            }
                        } satisfies delTemplate
                    }
                });

                await templateCache.updateTemplate(template.code);

                await discord.postWebMetric("template");

                return res.status(200).json({
                    error: false,
                    status: 200,
                    errors: [],
                    id: template.code
                });
            })
            .catch((error: DiscordAPIError) => {
                if (error.code === RESTJSONErrorCodes.UnknownGuildTemplate)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [
                            res.__("common.error.template.arr.invite.invalid")
                        ]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [
                        `${error.name}: ${error.message}`,
                        `${error.code} ${error.method} ${error.url}`
                    ]
                });
            });
    }
);

router.get("/:id", variables, async (req: Request, res: Response) => {
    res.locals.pageType = {
        server: false,
        bot: false,
        template: true
    };

    let template: delTemplate | undefined = await templateCache.getTemplate(
        req.params.id
    );
    if (!template) {
        template = await global.db
            .collection<delTemplate>("templates")
            .findOne({ _id: req.params.id });
        if (!template)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.template.404"),
                type: "Error",
                req: req,
                pageType: { template: false, bot: false, server: false }
            });
    }

    res.locals.premidPageInfo = res.__("premid.templates.view", template.name);

    let templateOwner: delUser | undefined = await userCache.getUser(
        template.owner.id
    );
    if (!templateOwner) {
        templateOwner = await global.db
            .collection<delUser>("users")
            .findOne({ _id: template.owner.id });
    }

    const dirty = entities.decode(md.render(template.longDesc));
    let clean: string;
    clean = sanitizeHtml(dirty, {
        allowedTags: htmlRef.minimal.tags,
        allowedAttributes: htmlRef.minimal.attributes,
        allowVulnerableTags: true
    });

    res.render("templates/serverTemplates/view", {
        title: `${template.name} | ${res.__("common.templates.discord")}`,
        subtitle: template.shortDesc,
        template,
        longDesc: clean,
        templateOwner,
        creatorHasProfile: !!(
            template.creator && (await userCache.getUser(template.creator.id))
        ),
        webUrl: settings.website.url,
        req,
        functions
    });
});

router.get("/:id/exists", permission.auth, async (req, res) => {
    res.type("text").send(
        String(await global.redis?.hexists("templates", req.params.id))
    );
});

router.get(
    "/:id/src",
    variables,
    permission.auth,
    permission.admin,
    async (req: Request, res: Response) => {
        if (req.params.id === "@me") {
            if (!req.user) return res.redirect("/auth/login");
            req.params.id = req.user.id;
        }

        if (!req.query.token) return res.json({});
        const tokenCheck = await tokenManager.verifyToken(
            req.user.id,
            req.query.token as string
        );
        if (tokenCheck === false) return res.json({});

        const cache = await templateCache.getTemplate(req.params.id);
        const db = await global.db
            .collection("templates")
            .findOne({ _id: req.params.id });

        return res.json({ cache: cache, db: db });
    }
);

router.get(
    "/:id/edit",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        const template: delTemplate | undefined = await global.db
            .collection<delTemplate>("templates")
            .findOne({ _id: req.params.id });

        if (!template)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.template.404"),
                type: "Error",
                req: req
            });

        if (
            template.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                subtitle: res.__("common.error.template.perms.edit"),
                status: 403,
                type: "Error",
                req
            });

        res.locals.premidPageInfo = res.__(
            "premid.templates.edit",
            template.name
        );

        const clean = sanitizeHtml(template.longDesc, {
            allowedTags: htmlRef.minimal.tags,
            allowedAttributes: htmlRef.minimal.attributes,
            allowVulnerableTags: true,
            disallowedTagsMode: "escape"
        });

        res.render("templates/serverTemplates/edit", {
            title: res.__("page.templates.edit.title"),
            subtitle: res.__("page.templates.edit.subtitle", template.name),
            req,
            template,
            longDesc: clean
        });
    }
);

router.post(
    "/:id/edit",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        let error = false;
        let errors = [];

        const dbTemplate: delTemplate | undefined = await global.db
            .collection<delTemplate>("templates")
            .findOne({ _id: req.params.id });

        if (!dbTemplate)
            return res.status(404).json({
                error: true,
                status: 404,
                errors: [res.__("common.error.template.404")]
            });

        if (
            dbTemplate.owner.id !== req.user.id &&
            req.user.db.rank.assistant === false
        )
            return res.status(403).json({
                error: true,
                status: 403,
                errors: [res.__("common.error.template.perms.edit")]
            });

        res.locals.premidPageInfo = res.__(
            "premid.templates.edit",
            dbTemplate.name
        );

        if (!req.body.code) {
            error = true;
            errors.push(res.__("common.error.template.arr.invite.invalid"));
        } else {
            if (
                typeof req.body.code !== "string" ||
                req.body.code.includes(" ")
            ) {
                error = true;
                errors.push(res.__("common.error.template.arr.invite.invalid"));
            } else if (req.body.code.length > 2000) {
                error = true;
                errors.push(res.__("common.error.template.arr.invite.tooLong"));
            } else if (functions.isURL(req.body.code)) {
                error = true;
                errors.push(res.__("common.error.template.arr.invite.isURL"));
            } else if (req.body.code.includes("discord.new")) {
                error = true;
                errors.push(res.__("common.error.template.arr.invite.dnew"));
            }
        }

        let linkToServerPage = false;
        if (req.body.ltsp === "on") linkToServerPage = true;

        if (!req.body.shortDescription) {
            error = true;
            errors.push(res.__("common.error.listing.arr.shortDescRequired"));
        } else if (req.body.shortDescription.length > 200) {
            error = true;
            errors.push(res.__("common.error.listing.arr.shortDescTooLong"));
        }

        let tags: string[] = [];
        if (req.body.gaming === true) tags.push("Gaming");
        if (req.body.music === true) tags.push("Music");
        if (req.body.mediaEntertain === true)
            tags.push("Media & Entertainment");
        if (req.body.createArts === true) tags.push("Creative Arts");
        if (req.body.sciTech === true) tags.push("Science & Tech");
        if (req.body.edu === true) tags.push("Education");
        if (req.body.fashBeaut === true) tags.push("Fashion & Beauty");

        if (req.body.relIdentity === true)
            tags.push("Relationships & Identity");
        if (req.body.travelCuis === true) tags.push("Travel & Food");
        if (req.body.fitHealth === true) tags.push("Fitness & Health");
        if (req.body.finance === true) tags.push("Finance");

        if (error === true)
            return res.status(400).json({
                error: true,
                status: 400,
                errors: errors
            });

        await discord.bot.rest
            .get(Routes.template(req.body.code))
            .then(async (template: APITemplate) => {
                await global.db.collection("templates").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            name: template.name,
                            region: template.serialized_source_guild.region,
                            locale: template.serialized_source_guild
                                .preferred_locale,
                            afkTimeout:
                                template.serialized_source_guild.afk_timeout,
                            verificationLevel:
                                template.serialized_source_guild
                                    .verification_level,
                            defaultMessageNotifications:
                                template.serialized_source_guild
                                    .default_message_notifications,
                            explicitContent:
                                template.serialized_source_guild
                                    .explicit_content_filter,
                            roles: template.serialized_source_guild.roles.map(
                                (c) => {
                                    return { name: c.name, color: c.color };
                                }
                            ),
                            channels:
                                template.serialized_source_guild.channels.map(
                                    (c) => {
                                        return {
                                            name: c.name,
                                            type: c.type,
                                            nsfw: c.nsfw
                                        };
                                    }
                                ),
                            usageCount: template.usage_count,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            tags: tags,
                            creator: {
                                id: template.creator.id,
                                username: template.creator.username,
                                discriminator: template.creator.discriminator
                            },
                            icon: {
                                hash: template.serialized_source_guild
                                    .icon_hash,
                                url: `https://cdn.discordapp.com/icons/${template.source_guild_id}/${template.serialized_source_guild.icon_hash}`
                            },
                            links: {
                                linkToServerPage: linkToServerPage,
                                template: `https://discord.new/${dbTemplate._id}`
                            }
                        } satisfies Partial<delTemplate>
                    }
                );

                await discord.channels.logs.send(
                    `${settings.emoji.edit} **${functions.escapeFormatting(
                        req.user.db.fullUsername
                    )}** \`(${
                        req.user.id
                    })\` edited template **${functions.escapeFormatting(
                        template.name
                    )}** \`(${template.code})\`\n<${
                        settings.website.url
                    }/templates/${template.code}>`
                );

                await global.db.collection("audit").insertOne({
                    type: "EDIT_TEMPLATE",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: {
                            name: template.name,
                            region: template.serialized_source_guild.region,
                            locale: template.serialized_source_guild
                                .preferred_locale,
                            afkTimeout:
                                template.serialized_source_guild.afk_timeout,
                            verificationLevel:
                                template.serialized_source_guild
                                    .verification_level,
                            defaultMessageNotifications:
                                template.serialized_source_guild
                                    .default_message_notifications,
                            explicitContent:
                                template.serialized_source_guild
                                    .explicit_content_filter,
                            roles: template.serialized_source_guild.roles.map(
                                (c) => {
                                    return { name: c.name, color: c.color };
                                }
                            ),
                            channels:
                                template.serialized_source_guild.channels.map(
                                    (c) => {
                                        return {
                                            name: c.name,
                                            type: c.type,
                                            nsfw: c.nsfw
                                        };
                                    }
                                ),
                            usageCount: template.usage_count,
                            shortDesc: req.body.shortDescription,
                            longDesc: req.body.longDescription,
                            tags: tags,
                            fromGuild: dbTemplate.fromGuild,
                            creator: {
                                id: template.creator.id,
                                username: template.creator.username,
                                discriminator: template.creator.discriminator
                            },
                            icon: {
                                hash: template.serialized_source_guild
                                    .icon_hash,
                                url: `https://cdn.discordapp.com/icons/${template.source_guild_id}/${template.serialized_source_guild.icon_hash}`
                            },
                            links: {
                                linkToServerPage: linkToServerPage,
                                template: `https://discord.new/${dbTemplate._id}`
                            }
                        } satisfies Partial<delTemplate>,
                        old: {
                            name: dbTemplate.name,
                            region: dbTemplate.region,
                            locale: dbTemplate.locale,
                            afkTimeout: dbTemplate.afkTimeout,
                            verificationLevel: dbTemplate.verificationLevel,
                            defaultMessageNotifications:
                                dbTemplate.defaultMessageNotifications,
                            explicitContent: dbTemplate.explicitContent,
                            roles: dbTemplate.roles,
                            channels: dbTemplate.channels,
                            usageCount: dbTemplate.usageCount,
                            shortDesc: dbTemplate.shortDesc,
                            longDesc: dbTemplate.longDesc,
                            tags: dbTemplate.tags,
                            fromGuild: dbTemplate.fromGuild,
                            creator: {
                                id: template.creator.id,
                                username: template.creator.username,
                                discriminator: template.creator.discriminator
                            },
                            icon: {
                                hash: dbTemplate.icon.hash,
                                url: dbTemplate.icon.url
                            },
                            links: {
                                linkToServerPage: linkToServerPage,
                                template: `https://discord.new/${dbTemplate._id}`
                            }
                        } satisfies Partial<delTemplate>
                    }
                });

                await templateCache.updateTemplate(req.params.id);

                return res.status(200).json({
                    error: false,
                    status: 200,
                    errors: [],
                    id: template.code
                });
            })
            .catch((error: DiscordAPIError) => {
                if (error.code === RESTJSONErrorCodes.UnknownGuildTemplate)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [
                            res.__("common.error.template.arr.invite.invalid")
                        ]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [
                        `${error.name}: ${error.message}`,
                        `${error.code} ${error.method} ${error.url}`
                    ]
                });
            });
    }
);

router.get(
    "/:id/delete",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        const template: delTemplate | undefined = await global.db
            .collection<delTemplate>("templates")
            .findOne({ _id: req.params.id });

        if (!template)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.template.404"),
                type: "Error",
                req: req
            });

        if (template.owner.id !== req.user.id)
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                subtitle: res.__("common.error.template.perms.delete"),
                status: 403,
                type: "Error",
                req
            });

        await discord.channels.logs.send(
            `${settings.emoji.delete} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` deleted template **${functions.escapeFormatting(
                template.name
            )}** \`(${template._id})\``
        );

        await global.db
            .collection("templates")
            .deleteOne({ _id: req.params.id });

        await global.db.collection("audit").insertOne({
            type: "DELETE_TEMPLATE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: "None specified."
        });

        await templateCache.deleteTemplate(req.params.id);

        await discord.postWebMetric("template");

        res.redirect("/users/@me");
    }
);

router.get(
    "/:id/remove",
    variables,
    permission.auth,
    permission.mod,
    async (req: Request, res: Response) => {
        const template: delTemplate | undefined = await global.db
            .collection<delTemplate>("templates")
            .findOne({ _id: req.params.id });

        if (!template)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.template.404"),
                req,
                type: "Error"
            });

        res.locals.premidPageInfo = res.__(
            "premid.templates.remove",
            template.name
        );

        res.render("templates/serverTemplates/staffActions/remove", {
            title: res.__("page.templates.remove.title"),
            subtitle: res.__("page.templates.remove.subtitle", template.name),
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
    async (req: Request, res: Response) => {
        const template: delTemplate | undefined = await global.db
            .collection<delTemplate>("templates")
            .findOne({ _id: req.params.id });

        if (!template)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.template.404"),
                req,
                type: "Error"
            });

        if (!req.body.reason && !req.user.db.rank.admin) {
            return res.status(400).render("status", {
                res,
                title: res.__("common.error"),
                status: 400,
                subtitle: res.__("common.error.reasonRequired"),
                req,
                type: "Error"
            });
        }

        await global.db
            .collection("templates")
            .deleteOne({ _id: req.params.id });

        const type = templateType(req.body.type);

        await global.db.collection("audit").insertOne({
            type: "REMOVE_TEMPLATE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            reasonType: type
        });

        await templateCache.deleteTemplate(req.params.id);

        const embed = new EmbedBuilder();
        embed.setColor(0x2f3136);
        embed.setTitle("Reason");
        embed.setDescription(req.body.reason);

        await discord.channels.logs.send({
            content: `${settings.emoji.delete} **${functions.escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${
                req.user.id
            })\` removed template **${functions.escapeFormatting(
                template.name
            )}** \`(${template._id})\``,
            embeds: [embed]
        });

        const owner = await discord.getMember(template.owner.id);
        if (owner)
            owner
                .send(
                    `${
                        settings.emoji.delete
                    } **|** Your template **${functions.escapeFormatting(
                        template.name
                    )}** \`(${
                        template._id
                    })\` has been removed!\n**Reason:** \`${
                        req.body.reason || "None specified."
                    }\``
                )
                .catch((e) => {
                    console.error(e);
                });

        await discord.postWebMetric("template");

        res.redirect("/templates");
    }
);

router.get(
    "/:id/sync",
    variables,
    permission.auth,
    async (req: Request, res: Response) => {
        const dbTemplate: delTemplate | undefined = await global.db
            .collection<delTemplate>("templates")
            .findOne({ _id: req.params.id });

        if (!dbTemplate)
            return res.status(404).render("status", {
                res,
                title: res.__("common.error"),
                status: 404,
                subtitle: res.__("common.error.template.404"),
                req,
                type: "Error"
            });

        await discord.bot.rest
            .get(Routes.template(req.params.id))
            .then(async (template: APITemplate) => {
                await global.db.collection("templates").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            name: template.name,
                            region: template.serialized_source_guild.region,
                            locale: template.serialized_source_guild
                                .preferred_locale,
                            afkTimeout:
                                template.serialized_source_guild.afk_timeout,
                            verificationLevel:
                                template.serialized_source_guild
                                    .verification_level,
                            defaultMessageNotifications:
                                template.serialized_source_guild
                                    .default_message_notifications,
                            explicitContent:
                                template.serialized_source_guild
                                    .explicit_content_filter,
                            roles: template.serialized_source_guild.roles.map(
                                (c) => {
                                    return { name: c.name, color: c.color };
                                }
                            ),
                            channels:
                                template.serialized_source_guild.channels.map(
                                    (c) => {
                                        return {
                                            name: c.name,
                                            type: c.type,
                                            nsfw: c.nsfw
                                        };
                                    }
                                ),
                            usageCount: template.usage_count,
                            creator: {
                                id: template.creator.id,
                                username: template.creator.username,
                                discriminator: template.creator.discriminator
                            },
                            icon: {
                                hash: template.serialized_source_guild
                                    .icon_hash,
                                url: `https://cdn.discordapp.com/icons/${template.source_guild_id}/${template.serialized_source_guild.icon_hash}`
                            }
                        } satisfies Partial<delTemplate>
                    }
                );

                await global.db.collection("audit").insertOne({
                    type: "SYNC_TEMPLATE",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: {
                            name: template.name,
                            region: template.serialized_source_guild.region,
                            locale: template.serialized_source_guild
                                .preferred_locale,
                            afkTimeout:
                                template.serialized_source_guild.afk_timeout,
                            verificationLevel:
                                template.serialized_source_guild
                                    .verification_level,
                            defaultMessageNotifications:
                                template.serialized_source_guild
                                    .default_message_notifications,
                            explicitContent:
                                template.serialized_source_guild
                                    .explicit_content_filter,
                            roles: template.serialized_source_guild.roles.map(
                                (c) => {
                                    return { name: c.name, color: c.color };
                                }
                            ),
                            channels:
                                template.serialized_source_guild.channels.map(
                                    (c) => {
                                        return {
                                            name: c.name,
                                            type: c.type,
                                            nsfw: c.nsfw
                                        };
                                    }
                                ),
                            usageCount: template.usage_count,
                            creator: {
                                id: template.creator.id,
                                username: template.creator.username,
                                discriminator: template.creator.discriminator
                            },
                            icon: {
                                hash: template.serialized_source_guild
                                    .icon_hash,
                                url: `https://cdn.discordapp.com/icons/${template.source_guild_id}/${template.serialized_source_guild.icon_hash}`
                            }
                        } satisfies Partial<delTemplate>,
                        old: {
                            name: dbTemplate.name,
                            region: dbTemplate.region,
                            locale: dbTemplate.locale,
                            afkTimeout: dbTemplate.afkTimeout,
                            verificationLevel: dbTemplate.verificationLevel,
                            defaultMessageNotifications:
                                dbTemplate.defaultMessageNotifications,
                            explicitContent: dbTemplate.explicitContent,
                            roles: dbTemplate.roles,
                            channels: dbTemplate.channels,
                            usageCount: dbTemplate.usageCount,
                            creator: {
                                id: template.creator.id,
                                username: template.creator.username,
                                discriminator: template.creator.discriminator
                            },
                            icon: {
                                hash: dbTemplate.icon.hash,
                                url: dbTemplate.icon.url
                            }
                        } satisfies Partial<delTemplate>
                    }
                });

                await templateCache.updateTemplate(req.params.id);
            })
            .catch((error: DiscordAPIError) => {
                if (error.code === RESTJSONErrorCodes.UnknownGuildTemplate)
                    return res.status(400).render("status", {
                        res,
                        title: res.__("common.error"),
                        status: 400,
                        subtitle: res.__(
                            "common.error.template.arr.invite.invalid"
                        ),
                        req,
                        type: "Error"
                    });

                return res.status(400).render("status", {
                    res,
                    title: res.__("common.error"),
                    status: 400,
                    subtitle: `${error.name}: ${error.message} | ${error.code} ${error.method} ${error.url}`,
                    req,
                    type: "Error"
                });
            });

        res.redirect(`/templates/${req.params.id}`);
    }
);

export default router;

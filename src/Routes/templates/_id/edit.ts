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

import { PathRoute } from "../../route.ts";
import type { Request, Response } from "express";

import settings from "../../../../settings.json" with { type: "json" };

import * as discord from "../../../Util/Services/discord.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as functions from "../../../Util/Function/main.ts";
import * as templateCache from "../../../Util/Services/templateCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import type { APITemplate, DiscordAPIError } from "discord.js";
import { RESTJSONErrorCodes, Routes } from "discord.js";
import { renderStatus } from "../../../Util/Function/main.ts";
import { templateExists } from "../../../Util/Middleware/checks.ts";
import { sanitizeMinimalHtmlEscaped } from "../../../Util/Function/sanitize.ts";
import { ownsOrAssistant } from "../../../Util/Function/main.ts";
import { websiteLogMessage } from "../../../Util/Function/main.ts";
import { communityTags } from "../../../Util/Function/serverListing.ts";

export class GetEditTemplate extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/edit", [variables, permission.auth, templateExists]);
    }

    async handle(req: Request, res: Response) {
        const template: delTemplate | undefined = req.attached.template!;

        if (!ownsOrAssistant(req, template))
            return renderStatus(
                req,
                res,
                403,
                res.__("common.error.template.perms.edit")
            );

        res.locals.premidPageInfo = res.__(
            "premid.templates.edit",
            template.name
        );

        const clean = sanitizeMinimalHtmlEscaped(template.longDesc);

        res.render("templates/serverTemplates/edit", {
            title: res.__("page.templates.edit.title"),
            subtitle: res.__("page.templates.edit.subtitle", template.name),
            req,
            template,
            longDesc: clean
        });
    }
}

export class PostEditTemplate extends PathRoute<"post"> {
    constructor() {
        super("post", "/:id/edit", [variables, permission.auth]);
    }

    async handle(req: Request, res: Response) {
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

        if (!ownsOrAssistant(req, dbTemplate))
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

        let tags: string[] = communityTags(req.body);

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
                    websiteLogMessage(
                        req,
                        settings.emoji.edit,
                        "edited template",
                        template.name,
                        template.code,
                        `\n<${settings.website.url}/templates/${template.code}>`
                    )
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
}

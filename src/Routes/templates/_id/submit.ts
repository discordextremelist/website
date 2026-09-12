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

export class GetSubmitTemplate extends PathRoute<"get"> {
    constructor() {
        super("get", "/submit", [variables, permission.auth]);
    }

    handle(req: Request, res: Response) {
        res.locals.premidPageInfo = res.__("premid.templates.submit");

        res.render("templates/serverTemplates/submit", {
            title: res.__("common.nav.me.submitTemplate"),
            subtitle: res.__("common.nav.me.submitTemplate.subtitle"),
            req
        });
    }
}

export class PostSubmitTemplate extends PathRoute<"post"> {
    constructor() {
        super("post", "/submit", [variables, permission.auth]);
    }

    async handle(req: Request, res: Response) {
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
}

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
import * as discord from "../../../Util/Services/discord.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as templateCache from "../../../Util/Services/templateCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import type { APITemplate, DiscordAPIError } from "discord.js";
import { RESTJSONErrorCodes, Routes } from "discord.js";
import { renderStatus } from "../../../Util/Function/main.ts";

export class SyncTemplate extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/sync", [variables, permission.auth]);
    }

    async handle(req: Request, res: Response) {
        const dbTemplate: delTemplate | undefined = await global.db
            .collection<delTemplate>("templates")
            .findOne({ _id: req.params.id });

        if (!dbTemplate)
            return renderStatus(
                req,
                res,
                404,
                res.__("common.error.template.404")
            );

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

                res.redirect(`/templates/${req.params.id}`);
            })
            .catch((error: DiscordAPIError) => {
                if (error.code === RESTJSONErrorCodes.UnknownGuildTemplate)
                    return renderStatus(
                        req,
                        res,
                        400,
                        res.__("common.error.template.arr.invite.invalid")
                    );

                return renderStatus(
                    req,
                    res,
                    400,
                    `${error.name}: ${error.message} | ${error.code} ${error.method} ${error.url}`
                );
            });
    }
}

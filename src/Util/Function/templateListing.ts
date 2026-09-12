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

import type { APITemplate } from "discord.js";

type TemplateGuildFields = Pick<
    delTemplate,
    | "region"
    | "locale"
    | "afkTimeout"
    | "verificationLevel"
    | "defaultMessageNotifications"
    | "explicitContent"
    | "roles"
    | "channels"
>;

/**
 * The fields of a template listing that come from Discord's snapshot of the
 * source server, in the order the listing stores them. Shared by template
 * submit, edit, sync and autosync, for both the record and its audit entry.
 */
export function templateGuildFields(
    template: APITemplate
): TemplateGuildFields {
    return {
        region: template.serialized_source_guild.region,
        locale: template.serialized_source_guild.preferred_locale,
        afkTimeout: template.serialized_source_guild.afk_timeout,
        verificationLevel: template.serialized_source_guild.verification_level,
        defaultMessageNotifications:
            template.serialized_source_guild.default_message_notifications,
        explicitContent:
            template.serialized_source_guild.explicit_content_filter,
        roles: template.serialized_source_guild.roles.map((c) => {
            return { name: c.name, color: c.color };
        }),
        channels: template.serialized_source_guild.channels.map((c) => {
            return { name: c.name, type: c.type, nsfw: c.nsfw };
        })
    };
}

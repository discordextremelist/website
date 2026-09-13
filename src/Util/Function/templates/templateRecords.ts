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

// The documents and audit entries written when a template listing is
// submitted, edited or synced. Each builder keeps the exact fields and key
// order of the literal it replaced, quirks included; they are noted where
// they are.

import type { APITemplate } from "discord.js";
import { templateGuildFields } from "./templateListing.ts";

/** The template's creator, as Discord reports them. */
const creator = (template: APITemplate) => ({
    id: template.creator.id,
    username: template.creator.username,
    discriminator: template.creator.discriminator
});

/** The source server's icon on Discord's CDN. */
const icon = (template: APITemplate) => ({
    hash: template.serialized_source_guild.icon_hash,
    url: `https://cdn.discordapp.com/icons/${template.source_guild_id}/${template.serialized_source_guild.icon_hash}`
});

/** A stored template's copy of the source-server fields, for audit entries. */
const storedGuildFields = (stored: delTemplate) => ({
    region: stored.region,
    locale: stored.locale,
    afkTimeout: stored.afkTimeout,
    verificationLevel: stored.verificationLevel,
    defaultMessageNotifications: stored.defaultMessageNotifications,
    explicitContent: stored.explicitContent,
    roles: stored.roles,
    channels: stored.channels
});

/**
 * The document a submitted template is stored as, which is also the
 * SUBMIT_TEMPLATE entry's `new` copy.
 */
export function submittedTemplate(
    req: AuthedRequest,
    template: APITemplate,
    tags: string[]
) {
    const body = req.body;
    return {
        _id: template.code,
        name: template.name,
        ...templateGuildFields(template),
        usageCount: template.usage_count,
        shortDesc: body.shortDescription,
        longDesc: body.longDescription,
        tags: tags,
        fromGuild: template.source_guild_id,
        owner: {
            id: req.user.id
        },
        creator: creator(template),
        icon: icon(template),
        links: {
            linkToServerPage: false,
            template: `https://discord.new/${template.code}`
        }
    } satisfies delTemplate;
}

/** What an edit $sets. */
export function editedTemplateFields(
    req: AuthedRequest,
    template: APITemplate,
    stored: delTemplate,
    tags: string[],
    linkToServerPage: boolean
) {
    const body = req.body;
    return {
        name: template.name,
        ...templateGuildFields(template),
        usageCount: template.usage_count,
        shortDesc: body.shortDescription,
        longDesc: body.longDescription,
        tags: tags,
        creator: creator(template),
        icon: icon(template),
        links: {
            linkToServerPage: linkToServerPage,
            template: `https://discord.new/${stored._id}`
        }
    } satisfies Partial<delTemplate>;
}

/** The EDIT_TEMPLATE entry's `new` copy: the edit, plus fromGuild. */
export function editedTemplateAuditAfter(
    req: AuthedRequest,
    template: APITemplate,
    stored: delTemplate,
    tags: string[],
    linkToServerPage: boolean
) {
    const body = req.body;
    return {
        name: template.name,
        ...templateGuildFields(template),
        usageCount: template.usage_count,
        shortDesc: body.shortDescription,
        longDesc: body.longDescription,
        tags: tags,
        fromGuild: stored.fromGuild,
        creator: creator(template),
        icon: icon(template),
        links: {
            linkToServerPage: linkToServerPage,
            template: `https://discord.new/${stored._id}`
        }
    } satisfies Partial<delTemplate>;
}

/**
 * The EDIT_TEMPLATE entry's `old` copy. Its creator and link-to-server-page
 * setting are the new ones, as they always were.
 */
export function editedTemplateAuditBefore(
    template: APITemplate,
    stored: delTemplate,
    linkToServerPage: boolean
) {
    return {
        name: stored.name,
        ...storedGuildFields(stored),
        usageCount: stored.usageCount,
        shortDesc: stored.shortDesc,
        longDesc: stored.longDesc,
        tags: stored.tags,
        fromGuild: stored.fromGuild,
        creator: creator(template),
        icon: {
            hash: stored.icon.hash,
            url: stored.icon.url
        },
        links: {
            linkToServerPage: linkToServerPage,
            template: `https://discord.new/${stored._id}`
        }
    } satisfies Partial<delTemplate>;
}

/**
 * What a sync $sets from Discord (the template page's sync button and
 * AutoSync), which is also the SYNC_TEMPLATE entry's `new` copy.
 */
export function syncedTemplateFields(template: APITemplate) {
    return {
        name: template.name,
        ...templateGuildFields(template),
        usageCount: template.usage_count,
        creator: creator(template),
        icon: icon(template)
    } satisfies Partial<delTemplate>;
}

/**
 * The SYNC_TEMPLATE entry's `old` copy. Its creator is the new one, as it
 * always was.
 */
export function syncedTemplateAuditBefore(
    template: APITemplate,
    stored: delTemplate
) {
    return {
        name: stored.name,
        ...storedGuildFields(stored),
        usageCount: stored.usageCount,
        creator: creator(template),
        icon: {
            hash: stored.icon.hash,
            url: stored.icon.url
        }
    } satisfies Partial<delTemplate>;
}

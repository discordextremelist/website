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

// The documents and audit entries written when a server listing is
// submitted, edited or synced. Each builder keeps the exact fields and key
// order of the literal it replaced.

import type { APIInvite } from "discord.js";

type Guild = NonNullable<APIInvite["guild"]>;
type Body = Record<string, any>;

/** The member counts Discord reports with an invite. */
const counts = (invite: APIInvite) => ({
    online: invite.approximate_presence_count!,
    members: invite.approximate_member_count!
});

/** The server's icon on Discord's CDN. */
const icon = (guild: Guild) => ({
    hash: guild.icon,
    url: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}`
});

const links = (body: Body) => ({
    invite: `https://discord.gg/${body.invite}`,
    website: body.website,
    donation: body.donationUrl
});

/** The document a submitted server is stored as. */
export function submittedServer(
    req: AuthedRequest,
    invite: APIInvite,
    guild: Guild,
    tags: string[],
    reviewRequired: boolean
) {
    const body = req.body;
    return {
        _id: guild.id,
        inviteCode: body.invite,
        name: guild.name,
        shortDesc: body.shortDescription,
        longDesc: body.longDescription,
        previewChannel: body.previewChannel,
        tags: tags,
        counts: counts(invite),
        owner: {
            id: req.user.id
        },
        icon: icon(guild),
        links: links(body),
        status: {
            reviewRequired: reviewRequired
        }
    } satisfies delServer;
}

/** The SUBMIT_SERVER audit entry's copy, which lists owner before counts. */
export function submittedServerAudit(
    req: AuthedRequest,
    invite: APIInvite,
    guild: Guild,
    tags: string[],
    reviewRequired: boolean
) {
    const body = req.body;
    return {
        _id: guild.id,
        inviteCode: body.invite,
        name: guild.name,
        shortDesc: body.shortDescription,
        longDesc: body.longDescription,
        previewChannel: body.previewChannel,
        tags: tags,
        owner: {
            id: req.user.id
        },
        counts: counts(invite),
        icon: icon(guild),
        links: links(body),
        status: {
            reviewRequired: reviewRequired
        }
    } satisfies delServer;
}

/** What an edit $sets, which is also the EDIT_SERVER entry's `new` copy. */
export function editedServerFields(
    req: AuthedRequest,
    invite: APIInvite,
    guild: Guild,
    tags: string[],
    reviewRequired: boolean
) {
    const body = req.body;
    return {
        name: guild.name,
        shortDesc: body.shortDescription,
        longDesc: body.longDescription,
        inviteCode: body.invite,
        previewChannel: body.previewChannel,
        tags: tags,
        counts: counts(invite),
        icon: icon(guild),
        links: links(body),
        status: {
            reviewRequired: reviewRequired
        }
    } satisfies Partial<delServer>;
}

/** The EDIT_SERVER entry's `old` copy of the server. */
export function editedServerAuditBefore(server: delServer) {
    return {
        name: server.name,
        shortDesc: server.shortDesc,
        longDesc: server.longDesc,
        inviteCode: server.inviteCode,
        previewChannel: server.previewChannel,
        tags: server.tags,
        counts: {
            online: server.counts.online,
            members: server.counts.members
        },
        icon: {
            hash: server.icon.hash,
            url: server.icon.url
        },
        links: {
            invite: server.links.invite,
            website: server.links.website,
            donation: server.links.donation
        },
        status: {
            reviewRequired: server.status.reviewRequired
        }
    } satisfies Partial<delServer>;
}

/**
 * What a sync $sets from Discord (the server page's sync button and
 * AutoSync), which is also the SYNC_SERVER entry's `new` copy.
 */
export function syncedServerFields(invite: APIInvite, guild: Guild) {
    return {
        name: guild.name,
        counts: counts(invite),
        icon: icon(guild)
    } satisfies Partial<delServer>;
}

/** The SYNC_SERVER entry's `old` copy of the server. */
export function syncedServerAuditBefore(server: delServer) {
    return {
        name: server.name,
        counts: {
            online: server.counts.online,
            members: server.counts.members
        },
        icon: {
            hash: server.icon.hash,
            url: server.icon.url
        }
    } satisfies Partial<delServer>;
}

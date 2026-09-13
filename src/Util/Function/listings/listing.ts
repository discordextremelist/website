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

// Checks shared by bot, server and template listings.

import { URL } from "url";
import { OAuth2Scopes } from "discord.js";

export function isURL(string: string) {
    try {
        return new URL(string).protocol === "https:";
    } catch {
        return false;
    }
}

export function parseScopes(
    scopes: delBot["scopes"]
): OAuth2Scopes | `${OAuth2Scopes}+${OAuth2Scopes}` {
    if (!scopes) return OAuth2Scopes.Bot;
    if (scopes.bot && scopes.slashCommands) {
        return `${OAuth2Scopes.Bot}+${OAuth2Scopes.ApplicationsCommands}` as const;
    } else if (scopes.slashCommands) {
        return OAuth2Scopes.ApplicationsCommands;
    } else return OAuth2Scopes.Bot;
}

/**
 * Whether the logged-in user may manage `listing`: they own it, they're one of
 * its editors (when `editors` is set), or they hold the assistant rank.
 *
 * This is the exact negation of the inline guards it replaced, which denied
 * when \`rank.assistant === false\`. So a user record with no assistant field
 * counts as allowed, and the checks short-circuit in the same order.
 */
export function ownsOrAssistant(
    req: AuthedRequest,
    listing: { owner: { id: string }; editors?: string[] },
    { editors = false }: { editors?: boolean } = {}
): boolean {
    return (
        listing.owner.id === req.user.id ||
        // Only bot routes pass `editors: true`, and delBot.editors is required.
        (editors && listing.editors!.includes(req.user.id)) ||
        req.user.db.rank.assistant !== false
    );
}

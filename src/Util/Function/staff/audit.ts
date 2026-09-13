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

// Audit log display and the reason types posted by staff forms.

import * as botCache from "../../Services/cache/botCaching.ts";
import * as userCache from "../../Services/cache/userCaching.ts";
import type { Response } from "express";

// The icon for each audit type the log knows how to show. Its name is the
// page.staff.audit.type.<type> message.
const AUDIT_ICONS = {
    MODIFY_RANK: "far fa-users-crown has-text-success",
    SET_VANITY: "far fa-link has-text-success",
    MODIFY_VANITY: "far fa-link has-text-warning",
    GAME_HIGHSCORE_UPDATE: "far fa-gamepad-alt has-text-success",
    MODIFY_PREFERENCES: "far fa-cog has-text-warning",
    MODIFY_PROFILE: "far fa-user-edit has-text-warning",
    SYNC_USER: "far fa-sync-alt has-text-success",
    APPROVE_BOT: "far fa-check has-text-success",
    UNAPPROVE_BOT: "far fa-minus has-text-orange",
    DECLINE_BOT: "far fa-times has-text-danger",
    DELETE_BOT: "far fa-trash has-text-danger",
    ARCHIVE_BOT: "far fa-archive has-text-warning",
    HIDE_BOT: "far fa-eye-slash has-text-white",
    UNHIDE_BOT: "far fa-eye has-text-white",
    MOD_HIDE_BOT: "far fa-eye-slash has-text-white",
    MOD_UNHIDE_BOT: "far fa-eye has-text-white",
    REMOVE_BOT: "far fa-trash has-text-danger",
    RESUBMIT_BOT: "far fa-redo has-text-warning",
    EDIT_BOT: "far fa-pen has-text-warning",
    RESET_BOT_TOKEN: "far fa-key has-text-orange",
    SYNC_BOT: "far fa-sync-alt has-text-success",
    PREMIUM_BOT_GIVE: "far fa-heart has-text-success",
    PREMIUM_BOT_TAKE: "far fa-heart-broken has-text-danger",
    SUBMIT_BOT: "far fa-plus has-text-success",
    UPVOTE_BOT: "far fa-arrow-alt-up has-text-success",
    DOWNVOTE_BOT: "far fa-arrow-alt-down has-text-danger",
    SUBMIT_SERVER: "far fa-plus has-text-success",
    EDIT_SERVER: "far fa-pen has-text-warning",
    SYNC_SERVER: "far fa-sync-alt has-text-success",
    DELETE_SERVER: "far fa-trash has-text-danger",
    REMOVE_SERVER: "far fa-trash has-text-danger",
    SUBMIT_TEMPLATE: "far fa-plus has-text-success",
    EDIT_TEMPLATE: "far fa-pen has-text-warning",
    SYNC_TEMPLATE: "far fa-sync-alt has-text-success",
    DELETE_TEMPLATE: "far fa-trash has-text-danger",
    REMOVE_TEMPLATE: "far fa-trash has-text-danger",
    UPDATE_AWAY: "far fa-lights-holiday has-text-success",
    RESET_AWAY: "far fa-briefcase has-text-danger",
    MODIFY_STANDING: "far fa-sort-numeric-up-alt has-text-success",
    ADD_WARNING: "far fa-exclamation-triangle has-text-warning",
    ADD_STRIKE: "far fa-ban has-text-danger",
    UPDATE_ANNOUNCEMENT: "far fa-megaphone has-text-success",
    RESET_ANNOUNCEMENT: "far fa-shredder has-text-danger"
} as const;

/** How the staff audit log shows an entry's type: its name and icon. */
export function parseAudit(__: Response["__"], auditType: string): auditType {
    // An own-property check, so a type like "toString" is still unknown.
    if (!Object.prototype.hasOwnProperty.call(AUDIT_ICONS, auditType))
        return {
            name: `${__("page.staff.audit.type.UNKNOWN")}: ${auditType}`,
            icon: "far fa-question has-text-white"
        };

    const type = auditType as keyof typeof AUDIT_ICONS;
    return {
        name: __(`page.staff.audit.type.${type}`),
        icon: AUDIT_ICONS[type]
    };
}

export async function auditUserIDParse(id: string) {
    const user: delUser | null = await userCache.getUser(id);
    if (user) return `${user.fullUsername} (${id})`;

    const bot: delBot | undefined = await botCache.getBot(id);
    if (bot) return `${bot.name} (${id})`;

    return id;
}

/**
 * Parse the reason type posted by a staff removal/decline form, clamping
 * anything above `max` to 0 ("other").
 *
 * Kept exactly as the three per-resource copies behaved (ISSUES I-11): the bot
 * bound of 15 is one short of the last botReasons value, and a missing type
 * comes back as NaN.
 */
export function reasonType(bodyType: string, max: number): number {
    let type = parseInt(bodyType);

    if (type > max) type = 0;

    return type;
}

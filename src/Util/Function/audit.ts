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

import * as botCache from "../Services/botCaching.ts";
import * as userCache from "../Services/userCaching.ts";
import type { Response } from "express";

export function parseAudit(__: Response["__"], auditType: string): auditType {
    let returnType = {
        name: `${__("page.staff.audit.type.UNKNOWN")}: ${auditType}`,
        icon: "far fa-question has-text-white"
    };

    switch (auditType) {
        case "MODIFY_RANK":
            returnType.name = __("page.staff.audit.type.MODIFY_RANK");
            returnType.icon = "far fa-users-crown has-text-success";
            break;
        case "SET_VANITY":
            returnType.name = __("page.staff.audit.type.SET_VANITY");
            returnType.icon = "far fa-link has-text-success";
            break;
        case "MODIFY_VANITY":
            returnType.name = __("page.staff.audit.type.MODIFY_VANITY");
            returnType.icon = "far fa-link has-text-warning";
            break;
        case "GAME_HIGHSCORE_UPDATE":
            returnType.name = __("page.staff.audit.type.GAME_HIGHSCORE_UPDATE");
            returnType.icon = "far fa-gamepad-alt has-text-success";
            break;
        case "MODIFY_PREFERENCES":
            returnType.name = __("page.staff.audit.type.MODIFY_PREFERENCES");
            returnType.icon = "far fa-cog has-text-warning";
            break;
        case "MODIFY_PROFILE":
            returnType.name = __("page.staff.audit.type.MODIFY_PROFILE");
            returnType.icon = "far fa-user-edit has-text-warning";
            break;
        case "SYNC_USER":
            returnType.name = __("page.staff.audit.type.SYNC_USER");
            returnType.icon = "far fa-sync-alt has-text-success";
            break;
        case "APPROVE_BOT":
            returnType.name = __("page.staff.audit.type.APPROVE_BOT");
            returnType.icon = "far fa-check has-text-success";
            break;
        case "UNAPPROVE_BOT":
            returnType.name = __("page.staff.audit.type.UNAPPROVE_BOT");
            returnType.icon = "far fa-minus has-text-orange";
            break;
        case "DECLINE_BOT":
            returnType.name = __("page.staff.audit.type.DECLINE_BOT");
            returnType.icon = "far fa-times has-text-danger";
            break;
        case "DELETE_BOT":
            returnType.name = __("page.staff.audit.type.DELETE_BOT");
            returnType.icon = "far fa-trash has-text-danger";
            break;
        case "ARCHIVE_BOT":
            returnType.name = __("page.staff.audit.type.ARCHIVE_BOT");
            returnType.icon = "far fa-archive has-text-warning";
            break;
        case "HIDE_BOT":
            returnType.name = __("page.staff.audit.type.HIDE_BOT");
            returnType.icon = "far fa-eye-slash has-text-white";
            break;
        case "UNHIDE_BOT":
            returnType.name = __("page.staff.audit.type.UNHIDE_BOT");
            returnType.icon = "far fa-eye has-text-white";
            break;
        case "MOD_HIDE_BOT":
            returnType.name = __("page.staff.audit.type.MOD_HIDE_BOT");
            returnType.icon = "far fa-eye-slash has-text-white";
            break;
        case "MOD_UNHIDE_BOT":
            returnType.name = __("page.staff.audit.type.MOD_UNHIDE_BOT");
            returnType.icon = "far fa-eye has-text-white";
            break;
        case "REMOVE_BOT":
            returnType.name = __("page.staff.audit.type.REMOVE_BOT");
            returnType.icon = "far fa-trash has-text-danger";
            break;
        case "RESUBMIT_BOT":
            returnType.name = __("page.staff.audit.type.RESUBMIT_BOT");
            returnType.icon = "far fa-redo has-text-warning";
            break;
        case "EDIT_BOT":
            returnType.name = __("page.staff.audit.type.EDIT_BOT");
            returnType.icon = "far fa-pen has-text-warning";
            break;
        case "RESET_BOT_TOKEN":
            returnType.name = __("page.staff.audit.type.RESET_BOT_TOKEN");
            returnType.icon = "far fa-key has-text-orange";
            break;
        case "SYNC_BOT":
            returnType.name = __("page.staff.audit.type.SYNC_BOT");
            returnType.icon = "far fa-sync-alt has-text-success";
            break;
        case "PREMIUM_BOT_GIVE":
            returnType.name = __("page.staff.audit.type.PREMIUM_BOT_GIVE");
            returnType.icon = "far fa-heart has-text-success";
            break;
        case "PREMIUM_BOT_TAKE":
            returnType.name = __("page.staff.audit.type.PREMIUM_BOT_TAKE");
            returnType.icon = "far fa-heart-broken has-text-danger";
            break;
        case "SUBMIT_BOT":
            returnType.name = __("page.staff.audit.type.SUBMIT_BOT");
            returnType.icon = "far fa-plus has-text-success";
            break;
        case "UPVOTE_BOT":
            returnType.name = __("page.staff.audit.type.UPVOTE_BOT");
            returnType.icon = "far fa-arrow-alt-up has-text-success";
            break;
        case "DOWNVOTE_BOT":
            returnType.name = __("page.staff.audit.type.DOWNVOTE_BOT");
            returnType.icon = "far fa-arrow-alt-down has-text-danger";
            break;
        case "SUBMIT_SERVER":
            returnType.name = __("page.staff.audit.type.SUBMIT_SERVER");
            returnType.icon = "far fa-plus has-text-success";
            break;
        case "EDIT_SERVER":
            returnType.name = __("page.staff.audit.type.EDIT_SERVER");
            returnType.icon = "far fa-pen has-text-warning";
            break;
        case "SYNC_SERVER":
            returnType.name = __("page.staff.audit.type.SYNC_SERVER");
            returnType.icon = "far fa-sync-alt has-text-success";
            break;
        case "DELETE_SERVER":
            returnType.name = __("page.staff.audit.type.DELETE_SERVER");
            returnType.icon = "far fa-trash has-text-danger";
            break;
        case "REMOVE_SERVER":
            returnType.name = __("page.staff.audit.type.REMOVE_SERVER");
            returnType.icon = "far fa-trash has-text-danger";
            break;
        case "SUBMIT_TEMPLATE":
            returnType.name = __("page.staff.audit.type.SUBMIT_TEMPLATE");
            returnType.icon = "far fa-plus has-text-success";
            break;
        case "EDIT_TEMPLATE":
            returnType.name = __("page.staff.audit.type.EDIT_TEMPLATE");
            returnType.icon = "far fa-pen has-text-warning";
            break;
        case "SYNC_TEMPLATE":
            returnType.name = __("page.staff.audit.type.SYNC_TEMPLATE");
            returnType.icon = "far fa-sync-alt has-text-success";
            break;
        case "DELETE_TEMPLATE":
            returnType.name = __("page.staff.audit.type.DELETE_TEMPLATE");
            returnType.icon = "far fa-trash has-text-danger";
            break;
        case "REMOVE_TEMPLATE":
            returnType.name = __("page.staff.audit.type.REMOVE_TEMPLATE");
            returnType.icon = "far fa-trash has-text-danger";
            break;
        case "UPDATE_AWAY":
            returnType.name = __("page.staff.audit.type.UPDATE_AWAY");
            returnType.icon = "far fa-lights-holiday has-text-success";
            break;
        case "RESET_AWAY":
            returnType.name = __("page.staff.audit.type.RESET_AWAY");
            returnType.icon = "far fa-briefcase has-text-danger";
            break;
        case "MODIFY_STANDING":
            returnType.name = __("page.staff.audit.type.MODIFY_STANDING");
            returnType.icon = "far fa-sort-numeric-up-alt has-text-success";
            break;
        case "ADD_WARNING":
            returnType.name = __("page.staff.audit.type.ADD_WARNING");
            returnType.icon = "far fa-exclamation-triangle has-text-warning";
            break;
        case "ADD_STRIKE":
            returnType.name = __("page.staff.audit.type.ADD_STRIKE");
            returnType.icon = "far fa-ban has-text-danger";
            break;
        case "UPDATE_ANNOUNCEMENT":
            returnType.name = __("page.staff.audit.type.UPDATE_ANNOUNCEMENT");
            returnType.icon = "far fa-megaphone has-text-success";
            break;
        case "RESET_ANNOUNCEMENT":
            returnType.name = __("page.staff.audit.type.RESET_ANNOUNCEMENT");
            returnType.icon = "far fa-shredder has-text-danger";
            break;
    }

    return returnType;
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

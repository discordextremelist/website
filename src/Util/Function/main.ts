/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020 Carolina Mitchell-Acason, John Burke, Advaith Jagathesan

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

import * as botCache from "../Services/botCaching.js";
import * as userCache from "../Services/userCaching.js";
import { URL } from "url";
import { OAuth2Scopes } from "discord-api-types/v10";
export const escapeFormatting = (text: string) => {
    const unescaped = text.replace(/\\(\*|_|`|~|\\)/g, "$1");
    const escaped = unescaped.replace(/(\*|_|`|~|\\)/g, "\\$1");
    return escaped;
};

const regions = {
    "us-west": "US West",
    "us-east": "US East",
    "us-central": "US Central",
    "us-south": "US South",
    "singapore": "Singapore",
    "southafrica": "South Africa",
    "sydney": "Sydney",
    "europe": "Europe",
    "brazil": "Brazil",
    "hongkong": "Hong Kong",
    "russia": "Russia",
    "japan": "Japan",
    "india": "India",
    "dubai": "Dubai",
    "amsterdam": "Amsterdam",
    "london": "London",
    "frankfurt": "Frankfurt",
    "eu-central": "Central Europe",
    "eu-west": "Western Europe",
    "south-korea": "South Korea"
}

export const parseRegion = (region: keyof typeof regions) => regions[region] || region

export function regionIcon(region: keyof typeof regions) {
    let icon = "81b90eae4fc67502d59808a7c219ee65";

    switch (region) {
        case "us-west":
        case "us-east":
        case "us-central":
        case "us-south": icon = "e6d6b255259ac878d00819a9555072ad"; break;
        case "singapore": icon = "92cd1f9eabd48ec32dc2ecef617f706b"; break;
        case "southafrica": icon = "3a3ec02f3c9193e85bda10f5d2a42574"; break;
        case "sydney": icon = "1d8d4e2b3fd0e542b6d37cbfa156d55e"; break;
        case "europe":
        case "eu-central":
        case "eu-west": icon = "554a8e1a41c2e30cdb946396d3d336f2"; break;
        case "brazil": icon = "7beab7b17eaa9ff7ceed3e5b1af274c2"; break;
        case "hongkong": icon = "a92f116201fa7ff2b4acbb39f144ec60"; break;
        case "russia": icon = "64f37efd5319b9b581557604864f042a"; break;
        case "japan": icon = "f23c5c28c4429691f7c54af93876d661"; break;
        case "india": icon = "716d569d0bca379a84578572c6efc7ac"; break;
        case "dubai": icon = "0113e92896135807e30f5de869074733"; break;
        case "amsterdam": icon = "c9f51873ae719a6b4b8c6724362e999e"; break;
        case "london": icon = "3a79cdd1d4af225247f2ba574b97ae78"; break;
        case "frankfurt": icon = "7fa2adf98f26db34178bb30a63dabe8c"; break;
    }

    return icon;
}

export function getForeground(inputColour: string) {
    const colour =
        inputColour.charAt(0) === "#"
            ? inputColour.substring(1, 7)
            : inputColour;
    const R = parseInt(colour.substring(0, 2), 16);
    const G = parseInt(colour.substring(2, 4), 16);
    const B = parseInt(colour.substring(4, 6), 16);
    const uiColours = [R / 255, G / 255, B / 255];
    const c = uiColours.map((col) => {
        if (col <= 0.03928) {
            return col / 12.92;
        }
        return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return L > 0.179 ? "#000000" : "#FFFFFF";
}

export function standingParseEmoji(standing: string) {
    let result = "page.staff.manager.unavailable";

    if (standing === "Unmeasured")
        result = "page.staff.manager.unmeasured.emoji";
    if (standing === "Good") result = "page.staff.manager.good.emoji";
    if (standing === "Moderate") result = "page.staff.manager.moderate.emoji";
    if (standing === "Moderate-Bad")
        result = "page.staff.manager.moderateBad.emoji";
    if (standing === "Bad") result = "page.staff.manager.bad.emoji";

    return result;
}

export async function parseDate(__, locale: string, rawDate: number): Promise<string> {
    if (rawDate === 0) return "???";

    const date = new Date(rawDate);
    const { default: dateFormat } = await import(`../../../../node_modules/del-i18n/website/${locale}.json`, { assert: { type: "json" } })
    if (await dateFormat["common.dateFormat"].includes("{{amPM}}")) {
        let amPM: string;
        let hour = date.getUTCHours();
        let minute: any = date.getUTCMinutes();

        if (hour === 0) hour = 24;
        if (minute <= 9) minute = `0${minute}`;

        if (hour >= 12 && hour !== 24) {
            amPM = __("common.dateFormat.pm");
            if (hour > 12) hour = hour - 12;
        } else {
            amPM = __("common.dateFormat.am");
            if (hour === 24) hour = hour - 12;
        }

        return __("common.dateFormat", {
            hours: hour,
            minutes: minute,
            dateInMonth: date.getUTCDate(),
            monthNumber: date.getUTCMonth() + 1,
            amPM: amPM,
            year: date.getUTCFullYear()
        });
    } else {
        let hour: any = date.getUTCHours();
        let minute: any = date.getUTCMinutes();

        if (hour <= 9) hour = `0${hour}`;
        if (minute <= 9) minute = `0${minute}`;

        return __("common.dateFormat", {
            hours: hour,
            minutes: minute,
            dateInMonth: date.getUTCDate(),
            monthNumber: date.getUTCMonth() + 1,
            year: date.getUTCFullYear()
        });
    }
}

export function parseAudit(__, auditType: string): auditType {
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
    const user: delUser = await userCache.getUser(id);
    if (user) return `${user.fullUsername} (${id})`;

    const bot: delBot = await botCache.getBot(id);
    if (bot) return `${bot.name} (${id})`;

    return id;
}

export function shuffleArray<T>(array: T[]) {
    let currentIndex = array.length,
        temporaryValue,
        randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

export function isURL(string: string) {
    try {
        return new URL(string).protocol === 'https:'
    } catch {
        return false;
    }
}

export function parseScopes(scopes: delBot["scopes"]): OAuth2Scopes | `${OAuth2Scopes}+${OAuth2Scopes}` {
    if (!scopes) return OAuth2Scopes.Bot
    if (scopes.bot && scopes.slashCommands) {
        return `${OAuth2Scopes.Bot}+${OAuth2Scopes.ApplicationsCommands}` as const
    } else if (scopes.slashCommands) {
        return OAuth2Scopes.ApplicationsCommands
    } else return OAuth2Scopes.Bot
}

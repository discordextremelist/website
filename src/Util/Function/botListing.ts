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

import { isURL } from "./main.ts";
import type { Response } from "express";

// Helpers shared by the bot submit, edit and resubmit handlers, which all read
// the same listing form.

/** Display names of the tag checkboxes ticked on the bot listing form. */
export function botTags(body: Record<string, unknown>): string[] {
    const tags: string[] = [];
    if (body.fun === true) tags.push("Fun");
    if (body.social === true) tags.push("Social");
    if (body.economy === true) tags.push("Economy");
    if (body.utility === true) tags.push("Utility");
    if (body.moderation === true) tags.push("Moderation");
    if (body.multipurpose === true) tags.push("Multipurpose");
    if (body.music === true) tags.push("Music");
    return tags;
}

/**
 * The listing form's free-text editors field, reduced to unique user IDs:
 * split on anything that isn't a digit, dedupe, drop empties.
 */
export function parseEditors(raw: string): any[] {
    if (raw !== "") {
        return [...new Set(raw.split(/\D+/g))].filter(
            (editor) => editor !== ""
        );
    }
    return [];
}

const LINK_ERRORS = {
    supportServer: "common.error.listing.arr.invalidURL.supportServer",
    website: "common.error.listing.arr.invalidURL.website",
    donationUrl: "common.error.listing.arr.invalidURL.donation",
    repo: "common.error.listing.arr.invalidURL.repo",
    banner: "common.error.listing.arr.invalidURL.banner"
} as const;

/**
 * For each named link field that is filled in but is not a URL, the translated
 * error message, in the order the fields were given.
 */
export function invalidLinkErrors(
    body: Record<string, any>,
    res: Response,
    fields: (keyof typeof LINK_ERRORS)[]
): string[] {
    return fields
        .filter((field) => body[field] && !isURL(body[field]))
        .map((field) => res.__(LINK_ERRORS[field]));
}

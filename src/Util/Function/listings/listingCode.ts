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

import type { Response } from "express";
import { isURL } from "./listing.ts";

// The messages for each kind of code, and the link prefix people paste by
// mistake instead of the bare code.
const CODES = {
    invite: {
        invalid: "common.error.listing.arr.invite.invalid",
        tooLong: "common.error.listing.arr.invite.tooLong",
        isURL: "common.error.listing.arr.invite.isURL",
        prefixed: "common.error.server.arr.invite.dgg",
        prefix: "discord.gg"
    },
    template: {
        invalid: "common.error.template.arr.invite.invalid",
        tooLong: "common.error.template.arr.invite.tooLong",
        isURL: "common.error.template.arr.invite.isURL",
        prefixed: "common.error.template.arr.invite.dnew",
        prefix: "discord.new"
    }
} as const;

/**
 * The first problem with a server invite code or a template code from a
 * listing form, or undefined if there is none: missing, not a bare code,
 * longer than `maxLength`, a URL, or pasted with its link prefix.
 */
export function listingCodeError(
    code: unknown,
    res: Response,
    kind: keyof typeof CODES,
    maxLength: number
): string | undefined {
    const messages = CODES[kind];

    if (!code || typeof code !== "string" || code.includes(" "))
        return res.__(messages.invalid);
    if (code.length > maxLength) return res.__(messages.tooLong);
    if (isURL(code)) return res.__(messages.isURL);
    if (code.includes(messages.prefix)) return res.__(messages.prefixed);
    return undefined;
}

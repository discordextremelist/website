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

import { isDiscordAPIError, isURL } from "./main.ts";
import type { Request, Response } from "express";
import type {
    APIApplicationCommand,
    RESTPostOAuth2AccessTokenResult
} from "discord.js";
import { Routes } from "discord.js";
import fetch from "node-fetch";
import refresh from "passport-oauth2-refresh";
import { DAPI } from "../Services/discord.ts";
import * as userCache from "../Services/userCaching.ts";

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

/**
 * The bot's slash commands. When the user ticked "import slash commands",
 * they are fetched from Discord with the user's OAuth token; otherwise
 * `initial` is returned unchanged. Errors are reported through onError, which
 * the caller uses to set its error flag and push the message.
 *
 * Known bug, preserved deliberately (ISSUES I-8): requestNewAccessToken is
 * callback-style, so the `await` below does not wait for it. An expired token
 * is refreshed in the background while the fetch still uses the old one, and
 * refresh errors reach onError late.
 */
export async function fetchSlashCommands(
    req: Request,
    applicationId: string,
    initial: APIApplicationCommand[],
    onError: (message: string) => void
): Promise<APIApplicationCommand[]> {
    let commands = initial;

    if (req.body.slashCommands && req.user.db.auth) {
        if (Date.now() > req.user.db.auth.expires) {
            await refresh.requestNewAccessToken(
                "discord",
                req.user.db.auth.refreshToken,
                async (
                    err,
                    accessToken,
                    refreshToken,
                    result: RESTPostOAuth2AccessTokenResult
                ) => {
                    if (err) {
                        if (isDiscordAPIError(err)) {
                            onError(`${err.statusCode} ${err.data}`);
                        } else {
                            onError(err.message);
                        }
                    } else {
                        await global.db.collection("users").updateOne(
                            { _id: req.user.id },
                            {
                                $set: {
                                    auth: {
                                        accessToken,
                                        refreshToken,
                                        expires:
                                            Date.now() +
                                            result.expires_in * 1000
                                    }
                                }
                            }
                        );
                        await userCache.updateUser(req.user.id);
                    }
                }
            );
        }

        const receivedCommands = (await (
            await fetch(DAPI + Routes.applicationCommands(applicationId), {
                headers: {
                    authorization: `Bearer ${req.user.db.auth.accessToken}`
                }
            })
        )
            .json()
            .catch(() => {})) as APIApplicationCommand[];
        if (Array.isArray(receivedCommands)) commands = receivedCommands;
    }
    return commands;
}

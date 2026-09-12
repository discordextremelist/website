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
    RESTPostOAuth2AccessTokenResult,
    APIUser,
    DiscordAPIError
} from "discord.js";
import { Routes } from "discord.js";
import fetch, { type Response as fetchRes } from "node-fetch";
import refresh from "passport-oauth2-refresh";
import * as discord from "../Services/discord.ts";
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

/**
 * Validation messages for the listing's short description, long description
 * and prefix, in the order the handlers have always reported them.
 */
export function descriptionErrors(
    body: Record<string, any>,
    res: Response
): string[] {
    const messages: string[] = [];
    if (!body.shortDescription) {
        messages.push(res.__("common.error.listing.arr.shortDescRequired"));
    } else if (body.shortDescription.length > 200) {
        messages.push(res.__("common.error.listing.arr.shortDescTooLong"));
    }

    if (!body.longDescription) {
        messages.push(res.__("common.error.listing.arr.longDescRequired"));
    } else {
        if (
            body.longDescription.length < 150 &&
            !body.longDescription.includes("<iframe ")
        ) {
            messages.push(
                res.__("common.error.listing.arr.notAtMinChars", "150")
            );
        }

        if (body.longDescription.includes("http://")) {
            messages.push(res.__("common.error.listing.arr.containsHttp"));
        }
    }

    if (!body.prefix && !body.slashCommands) {
        messages.push(res.__("common.error.listing.arr.prefixRequired"));
    } else if (body.prefix?.length > 32) {
        messages.push(res.__("common.error.bot.arr.prefixTooLong"));
    } else if (body.prefix === "/" && !body.slashCommands) {
        messages.push(res.__("common.error.bot.arr.legacySlashPrefix"));
    }

    return messages;
}

/**
 * The bot user's public flags from Discord, or 0 when the listing isn't a bot.
 *
 * Known bug, preserved deliberately (ISSUES I-9): if the lookup fails, the
 * .catch() leaves `user` undefined and reading public_flags throws.
 */
export async function fetchUserFlags(
    wantBot: unknown,
    applicationId: string
): Promise<number> {
    let userFlags = 0;

    if (wantBot) {
        const user = (await discord.bot.rest
            .get(Routes.user(applicationId))
            .catch(() => {})) as APIUser;
        if (user.public_flags) userFlags = user.public_flags;
    }
    return userFlags;
}

/**
 * Validation messages for the listing's privacy-policy field, in the order the
 * handlers have always reported them. The field is required, and it must not
 * be a placeholder, a Discord link, a "help" page, or too long for a non-URL.
 */
export function privacyPolicyErrors(
    body: Record<string, any>,
    res: Response
): string[] {
    const messages: string[] = [];
    if (body.privacyPolicy) {
        if (body.privacyPolicy.length > 32 && !isURL(body.privacyPolicy)) {
            messages.push(res.__("common.error.bot.arr.privacyTooLong"));
        }
        if (
            ["discord.bot", "my-cool-app.com"].some((s) =>
                body.privacyPolicy.includes(s)
            )
        ) {
            messages.push(
                res.__("common.error.listing.arr.privacyPolicy.placeholder")
            );
        }
        if (body.privacyPolicy.includes("discord.com/privacy")) {
            messages.push(
                res.__("common.error.listing.arr.privacyPolicy.discord")
            );
        }
        if (/(yardım|yardim)/.test(body.privacyPolicy)) {
            messages.push(
                res.__("common.error.listing.arr.privacyPolicy.yardim")
            );
        }
        if (body.privacyPolicy.includes("help") && !isURL(body.privacyPolicy)) {
            messages.push(
                res.__("common.error.listing.arr.privacyPolicy.help")
            );
        }
    } else {
        messages.push(res.__("common.error.listing.arr.privacyPolicyRequired"));
    }
    return messages;
}

/**
 * Validation messages for the listing's widgetbot server and channel, in the
 * order the handlers have always reported them. When both IDs are set, each is
 * checked for shape and length, then looked up on Discord and on widgetbot.
 */
export async function widgetbotErrors(
    body: Record<string, any>,
    res: Response
): Promise<string[]> {
    const messages: string[] = [];
    if (body.widgetServer && !body.widgetChannel) {
        messages.push(
            res.__("common.error.listing.arr.widgetbot.serverButNotChannel")
        );
    }

    if (body.widgetChannel && !body.widgetServer) {
        messages.push(
            res.__("common.error.listing.arr.widgetbot.channelButNotServer")
        );
    }

    if (body.widgetServer && body.widgetChannel) {
        let fetchServer = true;

        if (
            Number.isNaN(body.widgetServer) ||
            body.widgetServer.includes(" ")
        ) {
            messages.push(
                res.__("common.error.listing.arr.widgetbot.serverID.invalid")
            );
            fetchServer = false;
        }
        if (body.widgetServer && body.widgetServer.length > 32) {
            messages.push(
                res.__("common.error.listing.arr.widgetbot.serverID.tooLong")
            );
            fetchServer = false;
        }

        if (fetchServer)
            await discord.bot.rest
                .get(Routes.guildChannels(body.widgetServer))
                .catch((e: DiscordAPIError) => {
                    if ([400, 404].includes(Number(e.code))) {
                        messages.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.serverID.nonexistent"
                            )
                        );
                        fetchServer = false;
                    }
                });

        if (fetchServer)
            await fetch("https://stonks.widgetbot.io/api/graphql", {
                method: "post",
                body: JSON.stringify({
                    query: `{guild(id:"${body.widgetServer}"){id}}`
                }),
                headers: { "Content-Type": "application/json" }
            })
                .then(async (fetchRes: fetchRes) => {
                    const data: any = await fetchRes.json();
                    if (data && !data.guild?.id) {
                        messages.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.guildNotFound"
                            )
                        );
                    }
                })
                .catch(() => {
                    messages.push(
                        res.__(
                            "common.error.listing.arr.widgetbot.guildNotFound"
                        )
                    );
                });

        let fetchChannel = true;

        if (
            Number.isNaN(body.widgetChannel) ||
            body.widgetChannel.includes(" ")
        ) {
            messages.push(
                res.__("common.error.listing.arr.widgetbot.channelID.invalid")
            );
            fetchChannel = false;
        }
        if (body.widgetChannel && body.widgetChannel.length > 32) {
            messages.push(
                res.__("common.error.listing.arr.widgetbot.channelID.tooLong")
            );
            fetchChannel = false;
        }

        if (fetchChannel)
            await discord.bot.rest
                .get(Routes.channel(body.widgetChannel))
                .catch((e: DiscordAPIError) => {
                    if ([400, 404].includes(Number(e.code))) {
                        messages.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.channelID.nonexistent"
                            )
                        );
                        fetchChannel = false;
                    }
                });

        if (fetchChannel)
            await fetch("https://stonks.widgetbot.io/api/graphql", {
                method: "post",
                body: JSON.stringify({
                    query: `{channel(id:"${body.widgetChannel}"){id}}`
                }),
                headers: { "Content-Type": "application/json" }
            })
                .then(async (fetchRes: fetchRes) => {
                    const data: any = await fetchRes.json();
                    if (!data.channel?.id) {
                        messages.push(
                            res.__(
                                "common.error.listing.arr.widgetbot.channelNotFound"
                            )
                        );
                    }
                })
                .catch(() => {
                    messages.push(
                        res.__(
                            "common.error.listing.arr.widgetbot.channelNotFound"
                        )
                    );
                });
    }
    return messages;
}

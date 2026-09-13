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

import { isURL, parseScopes } from "../listings/listing.ts";
import { patterns } from "./patterns.ts";
import { isDiscordAPIError } from "../common/discordErrors.ts";
import type { Response } from "express";
import type {
    APIApplication,
    APIApplicationCommand,
    RESTPostOAuth2AccessTokenResult,
    APIUser,
    DiscordAPIError
} from "discord.js";
import { OAuth2Scopes, RESTJSONErrorCodes, Routes } from "discord.js";
import { URL } from "url";
import fetch, { type Response as fetchRes } from "node-fetch";
import refresh from "passport-oauth2-refresh";
import * as discord from "../../Services/discord/index.ts";
import { DAPI } from "../../Services/discord/index.ts";
import * as userCache from "../../Services/cache/userCaching.ts";
import * as libraryCache from "../../Services/cache/libCaching.ts";
import { discordErrorJson, jsonError } from "../web/responses.ts";

// Helpers shared by the bot submit, edit and resubmit handlers, which all read
// the same listing form, and by bot sync and AutoSync.

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
 * The bot's slash commands. When `wanted` is set (the form's or the listing's
 * slash-commands flag) and `user` has an OAuth token, they are fetched from
 * Discord with that token, refreshing it first if it has expired; otherwise
 * `initial` is returned unchanged. Refresh errors go to onError, if given.
 *
 * Known bug, preserved deliberately (ISSUES I-8): requestNewAccessToken is
 * callback-style, so the `await` below does not wait for it. An expired token
 * is refreshed in the background while the fetch still uses the old one, and
 * refresh errors reach onError late.
 */
export async function fetchSlashCommands(
    user: delUser,
    wanted: unknown,
    applicationId: string,
    initial: APIApplicationCommand[],
    onError?: (message: string) => void
): Promise<APIApplicationCommand[]> {
    let commands = initial;

    if (wanted && user.auth) {
        if (Date.now() > user.auth.expires) {
            await refresh.requestNewAccessToken(
                "discord",
                user.auth.refreshToken,
                async (
                    err,
                    accessToken,
                    refreshToken,
                    result: RESTPostOAuth2AccessTokenResult
                ) => {
                    if (err) {
                        if (isDiscordAPIError(err)) {
                            onError?.(`${err.statusCode} ${err.data}`);
                        } else {
                            onError?.(err.message);
                        }
                    } else {
                        await global.db.collection("users").updateOne(
                            { _id: user._id },
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
                        await userCache.updateUser(user._id);
                    }
                }
            );
        }

        const receivedCommands = (await (
            await fetch(DAPI + Routes.applicationCommands(applicationId), {
                headers: {
                    authorization: `Bearer ${user.auth.accessToken}`
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

/**
 * Check a bot listing form, and work out the values the submit, edit and
 * resubmit handlers save. `bot` is the listing being edited or resubmitted
 * (unset on submit). `inviteScopes` also rejects a discord.com invite that
 * lacks the chosen scopes; only edit asks for that.
 *
 * Errors come back in one fixed order. As before, fetchSlashCommands can add
 * a token refresh error to the list after this returns (ISSUES I-8).
 */
export async function validateBotListing(
    req: AuthedRequest,
    res: Response,
    { bot, inviteScopes = false }: { bot?: delBot; inviteScopes?: boolean } = {}
) {
    const body = req.body;
    const errors: string[] = [];

    if (!body.bot && !body.slashCommands) {
        errors.push(res.__("common.error.bot.arr.noScopes"));
    }

    if (!bot) {
        if (!body.id) {
            errors.push(res.__("common.error.listing.arr.IDRequired"));
        }

        if (Number.isNaN(body.id) || body.id.includes(" ")) {
            errors.push(res.__("common.error.bot.arr.invalidID"));
        }

        if (body.id.length > 32) {
            errors.push(res.__("common.error.bot.arr.idTooLong"));
        }
    }

    if (body.clientID) {
        if (Number.isNaN(body.clientID) || body.clientID.includes(" ")) {
            errors.push(res.__("common.error.bot.arr.invalidClientID"));
        }

        if (body.clientID && body.clientID.length > 32) {
            errors.push(res.__("common.error.bot.arr.clientIDTooLong"));
        }

        // A client ID that is a user can't be a bot's application. Edit and
        // resubmit skip the lookup when it's the bot's own ID.
        if (!bot || body.clientID !== req.params.id)
            await discord.bot.rest
                .get(Routes.user(body.clientID))
                .then(() => {
                    errors.push(res.__("common.error.bot.arr.clientIDIsUser"));
                })
                .catch(() => {});
    }

    let invite: string | undefined;

    if (body.invite === "") {
        invite = `https://discord.com/api/oauth2/authorize?client_id=${body.clientID || (bot ? req.params.id : body.id)}&scope=${parseScopes(body)}`;
    } else if (typeof body.invite !== "string") {
        errors.push(res.__("common.error.listing.arr.invite.invalid"));
    } else if (body.invite.length > 2000) {
        errors.push(res.__("common.error.listing.arr.invite.tooLong"));
    } else if (!isURL(body.invite)) {
        errors.push(res.__("common.error.listing.arr.invite.urlInvalid"));
    } else if (body.invite.includes("discordapp.com")) {
        errors.push(res.__("common.error.listing.arr.invite.discordapp"));
    } else if (
        inviteScopes &&
        body.invite.includes("discord.com") &&
        ((body.bot && !body.invite.includes(OAuth2Scopes.Bot)) ||
            (body.slashCommands &&
                !body.invite.includes(OAuth2Scopes.ApplicationsCommands)))
    ) {
        errors.push(res.__("common.error.bot.arr.scopesNotInInvite"));
    } else {
        invite = body.invite;
    }

    errors.push(
        ...invalidLinkErrors(body, res, [
            "supportServer",
            "website",
            "donationUrl",
            "repo",
            "banner"
        ])
    );

    if (
        body.invite &&
        isURL(body.invite) &&
        Number(new URL(body.invite).searchParams.get("permissions")) & 8
    ) {
        errors.push(res.__("common.error.listing.arr.inviteHasAdmin"));
    }

    errors.push(...(await widgetbotErrors(body, res)));

    if (body.twitter?.length > 15) {
        errors.push(res.__("common.error.bot.arr.twitterInvalid"));
    }

    // Start of new URL checks go here
    // TODO: Check instances and verify they do not 404, invalid, etc.

    if (body.mastodon && !patterns.mastodon.test(body.mastodon)) {
        // @ts-expect-error TODO(B-8): key does not exist in del-i18n; add it in the socials PR.
        errors.push(res.__("common.error.listing.edit.mastodonInvalid"));
    }
    if (body.bluesky && !patterns.bluesky.test(body.bluesky)) {
        // @ts-expect-error TODO(B-8): key does not exist in del-i18n; add it in the socials PR.
        errors.push(res.__("common.error.listing.edit.blueskyInvalid"));
    }
    if (body.gitlab && !patterns.gitlab.test(body.gitlab)) {
        // @ts-expect-error TODO(B-8): key does not exist in del-i18n; add it in the socials PR.
        errors.push(res.__("common.error.listing.edit.gitlabInvalid"));
    }
    if (body.forgejo && !patterns.forgejo.test(body.forgejo)) {
        // @ts-expect-error TODO(B-8): key does not exist in del-i18n; add it in the socials PR.
        errors.push(res.__("common.error.listing.edit.forgejoInvalid"));
    }

    errors.push(...descriptionErrors(body, res));
    errors.push(...privacyPolicyErrors(body, res));

    const library = libraryCache.hasLib(body.library) ? body.library : "Other";
    const tags: string[] = botTags(body);
    const editors: any[] = parseEditors(body.editors);
    // Only the owner can be told to take themselves off; on submit, that's
    // whoever is submitting.
    if (
        editors.includes(req.user.id) &&
        (!bot || bot.owner.id === req.user.id)
    ) {
        errors.push(res.__("common.error.listing.arr.removeYourselfEditor"));
    }

    const commands: APIApplicationCommand[] = await fetchSlashCommands(
        req.user.db,
        body.slashCommands,
        bot ? bot._id : body.id,
        bot ? bot.commands || [] : [],
        (message) => {
            errors.push(message);
        }
    );

    const userFlags = await fetchUserFlags(body.bot, bot ? bot._id : body.id);

    return {
        errors,
        // Every branch above either sets invite or adds an error, and the
        // handlers only save when there are no errors.
        invite: invite!,
        library,
        tags,
        editors,
        commands,
        userFlags
    };
}

/**
 * Look up the application a bot listing form names, answer 400 if it isn't
 * public, and otherwise run `handle` with it. A failed lookup, or an error
 * `handle` throws, gets discordErrorJson's answer, as the submit, edit and
 * resubmit handlers always gave.
 */
export function withPublicApp(
    req: AuthedRequest,
    res: Response,
    handle: (app: APIApplication) => Promise<unknown>
) {
    return discord
        .restGet<APIApplication>(
            `/applications/${req.body.clientID || req.body.id}/rpc`
        )
        .then(async (app: APIApplication) => {
            if (app.bot_public === false)
                // not !app.bot_public; should not trigger when undefined
                return jsonError(res, 400, [
                    res.__("common.error.bot.arr.notPublic")
                ]);

            return handle(app);
        })
        .catch((error: DiscordAPIError) =>
            discordErrorJson(
                res,
                error,
                RESTJSONErrorCodes.UnknownApplication,
                res.__("common.error.bot.arr.notFound"),
                res.__("common.error.bot.arr.fetchError")
            )
        );
}

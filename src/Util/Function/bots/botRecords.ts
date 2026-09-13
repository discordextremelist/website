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

// The documents and audit entries written when a bot listing is submitted,
// edited or resubmitted. Each builder keeps the exact fields and key order of
// the literal it replaced, quirks included; they are noted where they are.

import crypto from "crypto";
import type { APIApplication } from "discord.js";
import type { validateBotListing } from "./botListing.ts";

/** What validateBotListing works out from the form. */
type FormValues = Omit<
    Awaited<ReturnType<typeof validateBotListing>>,
    "errors"
>;
type Body = Record<string, any>;

/** A new bot API token. */
export function newBotToken(id: string) {
    return "DELAPI_" + crypto.randomBytes(16).toString("hex") + `-${id}`;
}

/** The icon of the Discord application. */
export function appIcon(app: APIApplication) {
    return {
        hash: app.icon,
        url: `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}`
    };
}

const scopes = (body: Body) => ({
    bot: body.bot,
    slashCommands: body.slashCommands
});

const links = (body: Body, invite: string) => ({
    invite: invite,
    support: body.supportServer,
    website: body.website,
    donation: body.donationUrl,
    repo: body.repo,
    privacyPolicy: body.privacyPolicy
});

const theme = (body: Body, useCustomColour = body.useCustomColour) => ({
    useCustomColour,
    colour: body.colour,
    banner: body.banner
});

const widgetbot = (body: Body) => ({
    channel: body.widgetChannel,
    options: body.widgetOptions,
    server: body.widgetServer
});

const labels = (body: Body) => ({
    ai: !!body.ai,
    nsfw: !!body.nsfw
});

const NEW_STATUS = {
    approved: false,
    premium: false,
    siteBot: false,
    archived: false,
    hidden: false,
    modHidden: false
};

/** The document a submitted bot is stored as. */
export function submittedBot(
    req: AuthedRequest,
    app: APIApplication,
    v: FormValues
) {
    const body = req.body;
    return {
        _id: body.id,
        clientID: body.clientID,
        name: app.name,
        prefix: body.prefix,
        library: v.library,
        tags: v.tags,
        vanityUrl: "",
        serverCount: 0,
        shardCount: 0,
        token: newBotToken(body.id),
        shortDesc: body.shortDescription,
        longDesc: body.longDescription,
        modNotes: body.modNotes,
        lastDenyReason: "",
        reviewNotes: [],
        editors: v.editors,
        commands: v.commands,
        userFlags: v.userFlags,
        owner: {
            id: req.user.id
        },
        icon: appIcon(app),
        votes: {
            positive: [],
            negative: []
        },
        scopes: scopes(body),
        links: links(body, v.invite),
        social: {
            twitter: body.twitter,
            mastodon: body.mastodon,
            bluesky: body.bluesky,
            gitlab: body.gitlab,
            forgejo: body.forgejo
        },
        theme: theme(body),
        widgetbot: widgetbot(body),
        date: {
            submitted: Date.now(),
            approved: 0,
            edited: 0
        },
        status: { ...NEW_STATUS },
        labels: labels(body)
    } satisfies delBot;
}

/**
 * The SUBMIT_BOT audit entry's copy of the new bot. It has no clientID, date
 * or userFlags, only the Twitter social, and a token of its own, not the one
 * the bot was stored with.
 */
export function submittedBotAudit(
    req: AuthedRequest,
    app: APIApplication,
    v: FormValues
) {
    const body = req.body;
    return {
        _id: body.id,
        name: app.name,
        prefix: body.prefix,
        library: v.library,
        tags: v.tags,
        vanityUrl: "",
        serverCount: 0,
        shardCount: 0,
        token: newBotToken(body.id),
        shortDesc: body.shortDescription,
        longDesc: body.longDescription,
        modNotes: body.modNotes,
        lastDenyReason: "",
        reviewNotes: [],
        editors: v.editors,
        commands: v.commands,
        owner: {
            id: req.user.id
        },
        icon: appIcon(app),
        votes: {
            positive: [],
            negative: []
        },
        scopes: scopes(body),
        links: links(body, v.invite),
        social: {
            twitter: body.twitter
        },
        theme: theme(body),
        widgetbot: widgetbot(body),
        status: { ...NEW_STATUS },
        labels: labels(body)
    } satisfies delBot;
}

/** The fields edit and resubmit both $set from the form. */
function formFields(body: Body, app: APIApplication, v: FormValues) {
    return {
        clientID: body.clientID,
        name: app.name,
        prefix: body.prefix,
        library: v.library,
        tags: v.tags,
        shortDesc: body.shortDescription,
        longDesc: body.longDescription,
        editors: v.editors,
        commands: v.commands,
        userFlags: v.userFlags,
        icon: appIcon(app),
        scopes: scopes(body),
        links: links(body, v.invite)
    };
}

/** What an edit $sets. The auto-accent switch turns on the custom colour. */
export function editedBotFields(
    req: AuthedRequest,
    app: APIApplication,
    v: FormValues
) {
    const body = req.body;
    return {
        ...formFields(body, app, v),
        social: {
            twitter: body.twitter,
            mastodon: body.mastodon,
            bluesky: body.bluesky,
            gitlab: body.gitlab,
            forgejo: body.forgejo
        },
        theme: theme(body, body.useAutoAccent ? true : body.useCustomColour),
        widgetbot: widgetbot(body),
        labels: labels(body),
        "date.edited": Date.now()
    };
}

/**
 * What a resubmit $sets: it puts the bot back in the queue. Unlike edit it
 * doesn't save the socials, theme or widgetbot (ISSUES I-1).
 */
export function resubmittedBotFields(
    req: AuthedRequest,
    app: APIApplication,
    v: FormValues
) {
    const body = req.body;
    return {
        ...formFields(body, app, v),
        date: {
            submitted: Date.now(),
            approved: 0,
            edited: 0
        },
        labels: labels(body),
        "status.archived": false
    };
}

/**
 * The edit or resubmit audit entry's `old` copy of the bot. Its scopes are
 * taken from the form, not the bot, as they always were. Resubmit also
 * records that the bot was archived.
 */
export function botAuditBefore(
    req: AuthedRequest,
    bot: delBot,
    { resubmit = false } = {}
) {
    return {
        clientID: bot.clientID,
        name: bot.name,
        prefix: bot.prefix,
        library: bot.library,
        tags: bot.tags,
        shortDesc: bot.shortDesc,
        longDesc: bot.longDesc,
        editors: bot.editors,
        commands: bot.commands,
        // Older bots only have the deprecated avatar; the bot page falls
        // back to it, so record that.
        icon: bot.icon ?? bot.avatar,
        scopes: scopes(req.body),
        links: {
            invite: bot.links.invite,
            support: bot.links.support,
            website: bot.links.website,
            donation: bot.links.donation,
            repo: bot.links.repo,
            privacyPolicy: bot.links.privacyPolicy
        },
        social: {
            twitter: bot.social?.twitter
        },
        theme: {
            useCustomColour: bot.theme?.useCustomColour,
            colour: bot.theme?.colour,
            banner: bot.theme?.banner
        },
        widgetbot: {
            channel: bot.widgetbot.channel,
            options: bot.widgetbot.options,
            server: bot.widgetbot.server
        },
        ...(resubmit ? { status: { archived: true } } : {}),
        labels: bot.labels
    } satisfies partialBot;
}

/**
 * The edit or resubmit audit entry's `new` copy. It records the form's own
 * custom-colour choice, not the auto-accent override edit saves, and only
 * the Twitter social. Resubmit also records that the bot is no longer
 * archived.
 */
export function botAuditAfter(
    req: AuthedRequest,
    app: APIApplication,
    v: FormValues,
    { resubmit = false } = {}
) {
    const body = req.body;
    return {
        clientID: body.clientID,
        name: app.name,
        prefix: body.prefix,
        library: v.library,
        tags: v.tags,
        shortDesc: body.shortDescription,
        longDesc: body.longDescription,
        editors: v.editors,
        commands: v.commands,
        icon: appIcon(app),
        scopes: scopes(body),
        links: links(body, v.invite),
        social: {
            twitter: body.twitter
        },
        theme: theme(body),
        widgetbot: widgetbot(body),
        ...(resubmit ? { status: { archived: false } } : {}),
        labels: labels(body)
    } satisfies partialBot;
}

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

import { EmbedBuilder } from "discord.js";
import settings from "../../../settings.json" with { type: "json" };
import * as discord from "../Services/discord.ts";
import { escapeFormatting } from "./format.ts";

type Kind = "bot" | "server" | "template";

/**
 * How each event is posted: its emoji, the verb, and whether the line links
 * to the listing. `link` is set per event for now, keeping each line exactly
 * as it was.
 */
const EVENTS = {
    added: { emoji: settings.emoji.add, verb: "added", link: true },
    edited: { emoji: settings.emoji.edit, verb: "edited", link: true },
    resubmitted: {
        emoji: settings.emoji.resubmit,
        verb: "resubmitted",
        link: true
    },
    approved: { emoji: settings.emoji.check, verb: "approved", link: true },
    unapproved: {
        emoji: settings.emoji.unapprove,
        verb: "unapproved",
        link: false
    },
    archived: { emoji: settings.emoji.archive, verb: "archived", link: false },
    declined: { emoji: settings.emoji.cross, verb: "declined", link: false },
    hidden: { emoji: settings.emoji.hide, verb: "hid", link: false },
    unhidden: { emoji: settings.emoji.unhide, verb: "unhid", link: false },
    // A mod unhiding a bot linked to it; its owner unhiding it didn't.
    modUnhidden: { emoji: settings.emoji.unhide, verb: "unhid", link: true },
    removed: { emoji: settings.emoji.delete, verb: "removed", link: false },
    deleted: { emoji: settings.emoji.delete, verb: "deleted", link: false }
} as const;

type WebsiteEvent = keyof typeof EVENTS;

/**
 * Whether the listing is gone after the event: deleted, or removed (a removed
 * bot is only archived, so it stays).
 */
const gone = (kind: Kind, event: WebsiteEvent) =>
    event === "deleted" || (event === "removed" && kind !== "bot");

/** The listing's page. */
const listingURL = (kind: Kind, id: string) =>
    `${settings.website.url}/${kind}s/${id}`;

/**
 * Post to the website log channel (discord.channels.logs, the public channel
 * anyone on the DEL server can read) that a user or a system did `event` to a
 * listing:
 *
 *     <emoji> **<actor>** <verb> <kind> **<name>** (`<id>`)[ <detail>][\n<link>]
 *
 * `by` is the acting user's request, shown as their escaped name and ID, or a
 * system name such as "AutoSync System", shown as it is. Pass `reason` (even
 * when it's undefined) for events staff give a reason for; it goes out as a
 * "Reason" embed, linking to the listing if it still exists. `linkId` links
 * the line to another ID than the one shown (bot edit, ISSUES I-33).
 *
 * Server approvals and declines are LGBTQ+ reviews, and say so. Returns the
 * send() promise for the caller to await or catch. Not for the moderator-only
 * alerts channel.
 */
export function logListingEvent(
    by: AuthedRequest | string,
    kind: Kind,
    event: WebsiteEvent,
    listing: { _id: string; name: string },
    options: { reason?: string; linkId?: string } = {}
) {
    const { emoji, verb, link } = EVENTS[event];
    const actor =
        typeof by === "string"
            ? `**${by}**`
            : `**${escapeFormatting(by.user.db.fullUsername)}** \`(${by.user.id})\``;
    const lgbtReview = kind === "server";
    const detail =
        lgbtReview && event === "approved"
            ? " to be listed as an LGBTQ+ community."
            : "";
    const lineLink = link
        ? `\n<${listingURL(kind, options.linkId ?? listing._id)}>`
        : "";

    let embed: EmbedBuilder | undefined;
    if ("reason" in options) {
        embed = new EmbedBuilder();
        embed.setColor(0x2f3136);
        embed.setTitle("Reason");
        embed.setDescription(options.reason!);
        if (!gone(kind, event)) embed.setURL(listingURL(kind, listing._id));
        if (lgbtReview && event === "declined")
            embed.setFooter({
                text: "It will still be shown as a normal server, it was declined from being listed as an LGBTQ+ community."
            });
    }

    return discord.channels.logs.send({
        content: `${emoji} ${actor} ${verb} ${kind} **${escapeFormatting(listing.name)}** \`(${listing._id})\`${detail}${lineLink}`,
        embeds: embed ? [embed] : undefined
    });
}

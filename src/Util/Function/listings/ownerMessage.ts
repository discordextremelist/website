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

// Direct messages to a listing's owner about what staff or AutoSync did to
// it. The public website log line for the same event is logListingEvent's.

import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../Services/discord/index.ts";
import { escapeFormatting } from "../common/format.ts";

type Kind = "bot" | "server" | "template";

/**
 * Each event's emoji and what it tells the owner. A server's approval and
 * decline are LGBTQ+ reviews (the server stays listed either way), so they
 * read differently from a bot's.
 */
const OWNER_EVENTS: Record<
    "approved" | "unapproved" | "declined" | "hidden" | "unhidden" | "removed",
    { emoji: string; text: string | Partial<Record<Kind, string>> }
> = {
    approved: {
        emoji: settings.emoji.check,
        text: {
            bot: "has been approved on the website!",
            server: "was approved as being listed as an LGBTQ+ community."
        }
    },
    unapproved: {
        emoji: settings.emoji.unapprove,
        text: "has been unapproved!"
    },
    declined: {
        emoji: settings.emoji.cross,
        text: {
            bot: "has been declined.",
            server: "was declined from being listed as an LGBTQ+ community. It will still appear as a normal server."
        }
    },
    hidden: { emoji: settings.emoji.hide, text: "has been hidden!" },
    unhidden: {
        emoji: settings.emoji.check,
        text: "has been unhidden on the website!"
    },
    removed: { emoji: settings.emoji.delete, text: "has been removed!" }
};

/**
 * DM the owner `ownerId` that their listing had `event` done to it:
 *
 *     <emoji> **|** Your <kind> **<name>** (`<id>`) <text>[<note>][\n**Reason:** `<reason>`]
 *
 * Pass `reason` (even when it's undefined) for events staff give a reason for;
 * a blank one reads "None specified.". `note` adds a line after the text (bot
 * approval: when it will join the server). Returns messageMember's promise.
 */
export function messageListingOwner(
    ownerId: string,
    kind: Kind,
    event: keyof typeof OWNER_EVENTS,
    listing: { _id: string; name: string },
    options: { reason?: string; note?: string } = {}
) {
    const { emoji, text } = OWNER_EVENTS[event];
    // Only bots and servers are approved or declined, and both have text.
    const what = typeof text === "string" ? text : text[kind]!;
    const reason =
        "reason" in options
            ? `\n**Reason:** \`${options.reason || "None specified."}\``
            : "";
    return discord.messageMember(
        ownerId,
        `${emoji} **|** Your ${kind} **${escapeFormatting(listing.name)}** \`(${listing._id})\` ${what}${options.note ?? ""}${reason}`
    );
}

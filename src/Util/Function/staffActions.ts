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

// Shared by the staff actions on listings: approve, decline, remove, hide.

import type { Response } from "express";
import { EmbedBuilder } from "discord.js";
import * as userCache from "../Services/userCaching.ts";
import { renderStatus } from "./responses.ts";

type StaffAction =
    "approved" | "unapprove" | "declined" | "remove" | "modHidden";

/**
 * Count a staff action on the staff member's record: the total and, when
 * given, the action itself, both all-time and for this week. Then refresh
 * their cached record.
 */
export async function recordStaffAction(
    userId: string,
    kind: "Bots" | "Servers",
    action?: StaffAction
) {
    const field = `staffTracking.handled${kind}`;
    const counts: Record<string, number> = { [`${field}.allTime.total`]: 1 };
    if (action) counts[`${field}.allTime.${action}`] = 1;
    counts[`${field}.thisWeek.total`] = 1;
    if (action) counts[`${field}.thisWeek.${action}`] = 1;

    await global.db
        .collection("users")
        .updateOne({ _id: userId }, { $inc: counts });
    await userCache.updateUser(userId);
}

/**
 * The "Reason" embed posted to the website log with a removal, decline or
 * hide, linking to the listing when `url` is given.
 */
export function reasonEmbed(description: string, url?: string) {
    const embed = new EmbedBuilder();
    embed.setColor(0x2f3136);
    embed.setTitle("Reason");
    embed.setDescription(description);
    if (url !== undefined) embed.setURL(url);
    return embed;
}

/**
 * Staff removing, declining or hiding a listing must give a reason unless
 * they're an admin. When it's missing, render the 400 page and return true,
 * so the handler can stop.
 */
export function reasonMissing(req: AuthedRequest, res: Response): boolean {
    if (req.body.reason || req.user.db.rank.admin) return false;

    renderStatus(req, res, 400, res.__("common.error.reasonRequired"));
    return true;
}

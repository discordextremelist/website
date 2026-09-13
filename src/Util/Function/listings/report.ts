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
import { EmbedBuilder } from "discord.js";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../Services/discord/index.ts";
import { escapeFormatting } from "../common/format.ts";
import { jsonErrorMessage } from "../web/responses.ts";

const TITLES = {
    bot: "Bot Report",
    server: "Server Report",
    template: "Template Report"
} as const;

/**
 * Report a listing to the moderators, from the report form on its page: post
 * the reporter's reason and details to the alerts channel, and answer the
 * form. Owners can't report their own listing.
 *
 * The embed links to /bots/<id> for every kind, servers and templates
 * included (ISSUES I-31).
 */
export async function sendReport(
    req: AuthedRequest,
    res: Response,
    listing: { _id: string; name: string; owner: { id: string } },
    kind: keyof typeof TITLES
) {
    if (listing.owner.id === req.user.id)
        return jsonErrorMessage(res, 403, res.__("common.error.report.self"));

    try {
        const embed = new EmbedBuilder();
        embed.setColor(0x2f3136);
        embed.setTitle(TITLES[kind]);
        embed.setURL(`${settings.website.url}/bots/${listing._id}`);
        embed.addFields(
            {
                name: "Reason",
                value: req.body.reason ? req.body.reason : "None provided."
            },
            {
                name: "Additional information",
                value: req.body.additionalInfo
                    ? req.body.additionalInfo
                    : "None provided."
            }
        );

        await discord.channels.alerts.send({
            content: `${settings.emoji.report} **${escapeFormatting(
                req.user.db.fullUsername
            )}** \`(${req.user.id})\` reported ${kind} **${escapeFormatting(
                listing.name
            )}** \`(${listing._id})\``,
            embeds: [embed]
        });

        return res.status(200).json({
            error: false,
            status: 200,
            message: res.__("common.report.done")
        });
    } catch (e) {
        return jsonErrorMessage(res, 500, res.__("common.error.report"));
    }
}

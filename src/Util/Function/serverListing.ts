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

// Helpers shared by the server and template submit and edit handlers.

import type { Response } from "express";
import type { DiscordAPIError } from "discord.js";
import { Routes } from "discord.js";
import fetch, { type Response as fetchRes } from "node-fetch";
import { isURL } from "./main.ts";
import * as discord from "../Services/discord.ts";

/**
 * Validation messages for a server listing's links, preview channel and
 * descriptions, in the order the handlers have always reported them.
 */
export async function serverListingErrors(
    body: Record<string, any>,
    res: Response
): Promise<string[]> {
    const messages: string[] = [];
    if (body.website && !isURL(body.website)) {
        messages.push(res.__("common.error.listing.arr.invalidURL.website"));
    }

    if (body.donationUrl && !isURL(body.donationUrl)) {
        messages.push(res.__("common.error.listing.arr.invalidURL.donation"));
    }

    if (body.previewChannel) {
        let fetchChannel = true;

        if (
            Number.isNaN(body.previewChannel) ||
            body.previewChannel.includes(" ")
        ) {
            messages.push(
                res.__("common.error.server.arr.previewChannel.invalid")
            );
            fetchChannel = false;
        }
        if (body.previewChannel && body.previewChannel.length > 32) {
            messages.push(
                res.__("common.error.server.arr.previewChannel.tooLong")
            );
            fetchChannel = false;
        }

        if (fetchChannel)
            await discord.bot.rest
                .get(Routes.channel(body.previewChannel))
                .catch((e: DiscordAPIError) => {
                    if ([400, 404].includes(Number(e.code))) {
                        messages.push(
                            res.__(
                                "common.error.server.arr.previewChannel.nonexistent"
                            )
                        );
                        fetchChannel = false;
                    }
                });

        if (fetchChannel)
            await fetch("https://stonks.widgetbot.io/api/graphql", {
                method: "post",
                body: JSON.stringify({
                    query: `{channel(id:"${body.previewChannel}"){id}}`
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

    if (!body.shortDescription) {
        messages.push(res.__("common.error.listing.arr.shortDescRequired"));
    } else if (body.shortDescription.length > 200) {
        messages.push(res.__("common.error.listing.arr.shortDescTooLong"));
    }

    if (!body.longDescription) {
        messages.push(res.__("common.error.listing.arr.longDescRequired"));
    }
    return messages;
}

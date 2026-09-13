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

import * as botCache from "../../Services/cache/botCaching.ts";
import * as serverCache from "../../Services/cache/serverCaching.ts";
import * as templateCache from "../../Services/cache/templateCaching.ts";
import { logListingEvent } from "../listings/websiteLog.ts";
import { recordAudit } from "../staff/recordAudit.ts";

type OwnedListings = {
    bots: delBot[];
    servers: delServer[];
    templates: delTemplate[];
};

/** Every bot, server and template `ownerId` owns, straight from the database. */
export async function ownedListings(ownerId: string): Promise<OwnedListings> {
    const bots: delBot[] = await global.db
        .collection<delBot>("bots")
        .find({ "owner.id": ownerId })
        .toArray();

    const servers: delServer[] = await global.db
        .collection<delServer>("servers")
        .find({ "owner.id": ownerId })
        .toArray();

    const templates: delTemplate[] = await global.db
        .collection<delTemplate>("templates")
        .find({ "owner.id": ownerId })
        .toArray();

    return { bots, servers, templates };
}

/**
 * Delete `listings` because their owner's account is being deleted, `req`
 * being whoever is deleting it: each goes from the database and the cache,
 * with a DELETE_* audit entry and a website log line.
 */
export async function deleteListings(
    req: AuthedRequest,
    { bots, servers, templates }: OwnedListings
) {
    for (const bot of bots) {
        await global.db.collection("bots").deleteOne({ _id: bot._id });

        await recordAudit({
            type: "DELETE_BOT",
            executor: req.user.id,
            target: bot._id,
            reason: "Owner deleted their data and account."
        });

        await botCache.deleteBot(bot._id);

        await logListingEvent(req, "bot", "deleted", bot);
    }

    for (const server of servers) {
        await global.db.collection("servers").deleteOne({ _id: server._id });

        await recordAudit({
            type: "DELETE_SERVER",
            executor: req.user.id,
            target: server._id,
            reason: "Owner deleted their data and account."
        });

        await serverCache.deleteServer(server._id);

        await logListingEvent(req, "server", "deleted", server);
    }

    for (const template of templates) {
        await global.db
            .collection("templates")
            .deleteOne({ _id: template._id });

        await recordAudit({
            type: "DELETE_TEMPLATE",
            executor: req.user.id,
            target: template._id,
            reason: "Owner deleted their data and account."
        });

        await templateCache.deleteTemplate(template._id);

        await logListingEvent(req, "template", "deleted", template);
    }
}

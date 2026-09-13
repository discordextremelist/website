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

/**
 * The admin `/:id/src` view of a bot, server, template or user: its cached
 * copy and its database document, as JSON. `@me` means the admin
 * themselves.
 */
export async function sendSource(
    req: AuthedRequest,
    res: Response,
    collection: "bots" | "servers" | "templates" | "users",
    getCached: (id: string) => Promise<unknown>
) {
    if (req.params.id === "@me") {
        if (!req.user) return res.redirect("/auth/login");
        req.params.id = req.user.id;
    }

    const cache = await getCached(req.params.id);
    const db = await global.db
        .collection(collection)
        .findOne({ _id: req.params.id });

    return res.json({ cache: cache, db: db });
}

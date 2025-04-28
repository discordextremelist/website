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

import type { Request, Response } from "express";

export const botExists = async (
    req: Request,
    res: Response,
    next: () => void
) => {
    const bot = await global.db
        .collection<delBot>("bots")
        .findOne({ _id: req.params.id });

    if (!bot)
        return res.status(404).render("status", {
            res,
            title: res.__("common.error"),
            subtitle: res.__("common.error.bot.404"),
            status: 404,
            type: "Error",
            req
        });
    req.attached.bot = bot;
    next();
};

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

/**
 * Render the standard error page. Equivalent to
 *
 *     res.status(status).render("status", {
 *         res, title: res.__("common.error"), status, subtitle, req,
 *         type: "Error", ...extra
 *     });
 *
 * `extra` carries the occasional additional template local, such as `user` or
 * `pageType`.
 */
export function renderStatus(
    req: Request,
    res: Response,
    status: number,
    subtitle: string,
    extra: Record<string, unknown> = {}
) {
    return res.status(status).render("status", {
        res,
        title: res.__("common.error"),
        status,
        subtitle,
        req,
        type: "Error",
        ...extra
    });
}

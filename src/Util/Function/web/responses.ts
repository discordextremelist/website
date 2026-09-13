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
import type { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";

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

/**
 * Answer with the JSON error body the listing forms and JSON endpoints use:
 *
 *     res.status(status).json({ error: true, status, errors })
 */
export function jsonError(res: Response, status: number, errors: unknown[]) {
    return res.status(status).json({ error: true, status, errors });
}

/**
 * Answer a listing form that saved: a 200 JSON reply with no errors, plus
 * `extra` (servers and templates send the listing's id).
 */
export function jsonOk(res: Response, extra: Record<string, unknown> = {}) {
    return res
        .status(200)
        .json({ error: false, status: 200, errors: [], ...extra });
}

/**
 * Answer a listing form whose Discord lookup failed with a 400 JSON error:
 * just `known` when Discord answered `knownCode` (an unknown application,
 * invite or template), otherwise the error's details, after `prefix` if given.
 */
export function discordErrorJson(
    res: Response,
    error: DiscordAPIError,
    knownCode: RESTJSONErrorCodes,
    known: string,
    prefix?: string
) {
    if (error.code === knownCode) return jsonError(res, 400, [known]);

    return jsonError(res, 400, [
        ...(prefix === undefined ? [] : [prefix]),
        `${error.name}: ${error.message}`,
        `${error.code} ${error.method} ${error.url}`
    ]);
}

/**
 * discordErrorJson for pages: the 400 error page with `known`, or with the
 * error's details on one line. `knownCode` is optional.
 */
export function discordErrorPage(
    req: Request,
    res: Response,
    error: DiscordAPIError,
    knownCode?: RESTJSONErrorCodes,
    known?: string
) {
    if (knownCode !== undefined && error.code === knownCode)
        return renderStatus(req, res, 400, known!);

    return renderStatus(
        req,
        res,
        400,
        `${error.name}: ${error.message} | ${error.code} ${error.method} ${error.url}`
    );
}

/**
 * jsonError for the endpoints that send a single `message` instead of an
 * `errors` array (the report routes and search).
 */
export function jsonErrorMessage(
    res: Response,
    status: number,
    message: string
) {
    return res.status(status).json({ error: true, status, message });
}

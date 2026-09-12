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

import { OAuth2Scopes, Routes } from "discord.js";
import type { Request, Response } from "express";
import settings from "../../../settings.json" with { type: "json" };
import * as discord from "../Services/discord.ts";
import { renderStatus } from "../Function/main.ts";
/**
 * Consume the one-shot "just logged out" session flag. If it is set, clear it
 * and send the user home instead of continuing with a stale request.
 * Returns true when the request has been answered.
 */
const justLoggedOut = (req: Request, res: Response): boolean => {
    if (req.session.logoutJustCont === true) {
        req.session.logoutJust = false;
        req.session.logoutJustCont = false;
        res.redirect("/");
        return true;
    }
    return false;
};

export const auth = (req: Request, res: Response, next: () => void) => {
    if (justLoggedOut(req, res)) return;

    if (req.user) {
        next();
    } else {
        res.redirect("/auth/login");
    }
};

export const scopes =
    (scopes: OAuth2Scopes[]) =>
    (req: Request, res: Response, next: () => void) => {
        if (justLoggedOut(req, res)) return;

        if (
            !scopes.every((scope) => req.user.db.auth?.scopes?.includes(scope))
        ) {
            res.redirect(`/auth/login/callback?scope=${scopes.join(" ")}`);
        } else {
            next();
        }
    };

export const member = async (req: Request, res: Response, next: () => void) => {
    if (justLoggedOut(req, res)) return;

    if (!(await discord.getMember(req.body.id))) {
        await discord.bot.rest
            .get(Routes.guildMembers(settings.guild.main), {
                body: { access_token: req.user.db.auth.accessToken }
            })
            .catch(() => {});
    }

    next();
};

/**
 * Require the logged-in user to hold `rank`. Logged-out users get the normal
 * login redirect; logged-in users without the rank get a 403 page.
 */
const requireRank =
    (
        rank: "mod" | "assistant" | "admin",
        denied: Parameters<Response["__"]>[0]
    ) =>
    (req: Request, res: Response, next: () => void) => {
        if (justLoggedOut(req, res)) return;

        if (req.user) {
            if (req.user.db.rank[rank] === true) {
                next();
            } else {
                return renderStatus(req, res, 403, res.__(denied));
            }
        } else auth(req, res, next);
    };

export const mod = requireRank("mod", "common.error.notMod");
export const assistant = requireRank("assistant", "common.error.notAssistant");
export const admin = requireRank("admin", "common.error.notAdmin");

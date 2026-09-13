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
import * as tokenManager from "../Services/adminTokenManager.ts";
import { checkRoleHierarchyStaff, renderStatus } from "../Function/main.ts";
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
        const user = req.user;
        if (!user) return res.redirect("/auth/login");

        if (!scopes.every((scope) => user.db.auth?.scopes?.includes(scope))) {
            res.redirect(`/auth/login/callback?scope=${scopes.join(" ")}`);
        } else {
            next();
        }
    };

export const member = async (req: Request, res: Response, next: () => void) => {
    if (justLoggedOut(req, res)) return;
    if (!req.user) return res.redirect("/auth/login");

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

/**
 * Require the admin's current token as ?token=. Put it after `admin`. A
 * missing or wrong token gets an empty JSON object, as these routes have
 * always answered.
 */
export const adminToken = async (
    req: Request,
    res: Response,
    next: () => void
) => {
    if (!req.query.token) return res.json({});

    // `admin` runs first and only continues when req.user is set.
    const valid = await tokenManager.verifyToken(
        req.user!.id,
        req.query.token as string
    );
    if (!valid) return res.json({});

    next();
};

/**
 * Stop an assistant who isn't an admin from acting on another assistant's
 * user or staff record. Put it after `userExists`, which attaches the target.
 */
export const staffHierarchy = (
    req: Request,
    res: Response,
    next: () => void
) => {
    // userExists attached the target, and the rank check before it set
    // req.user.
    const target = req.attached.user!;

    if (
        target.rank.assistant === true &&
        checkRoleHierarchyStaff(req.user!.db, "assistant", true)
    )
        return renderStatus(
            req,
            res,
            403,
            res.__("page.users.modifyRank.assistantHierachyBlock.0")
        );

    next();
};

/** adminToken, enforced only in production. */
export const adminTokenInProd = (
    req: Request,
    res: Response,
    next: () => void
) => (global.env_prod ? adminToken(req, res, next) : next());

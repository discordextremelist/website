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
import { Request, Response } from "express";
import settings from "../../../settings.json" with { type: "json" };
import * as discord from "../Services/discord.js";
export const auth = (req: Request, res: Response, next: () => void) => {
    if (req.session.logoutJustCont === true) {
        req.session.logoutJust = false;
        req.session.logoutJustCont = false;
        return res.redirect("/");
    }

    if (req.user) {
        next();
    } else {
        res.redirect("/auth/login");
    }
};

export const scopes =
    (scopes: OAuth2Scopes[]) =>
    (req: Request, res: Response, next: () => void) => {
        if (req.session.logoutJustCont === true) {
            req.session.logoutJust = false;
            req.session.logoutJustCont = false;
            return res.redirect("/");
        }

        if (
            !scopes.every((scope) => req.user.db.auth?.scopes?.includes(scope))
        ) {
            res.redirect(`/auth/login/callback?scope=${scopes.join(" ")}`);
        } else {
            next();
        }
    };

export const member = async (req: Request, res: Response, next: () => void) => {
    if (req.session.logoutJustCont === true) {
        req.session.logoutJust = false;
        req.session.logoutJustCont = false;
        return res.redirect("/");
    }

    if (!(await discord.getMember(req.body.id))) {
        await discord.bot.rest
            .get(Routes.guildMembers(settings.guild.main), {
                body: { access_token: req.user.db.auth.accessToken }
            })
            .catch(() => {});
    }

    next();
};

export const mod = (req: Request, res: Response, next: () => void) => {
    if (req.session.logoutJustCont === true) {
        req.session.logoutJust = false;
        req.session.logoutJustCont = false;
        return res.redirect("/");
    }

    if (req.user) {
        if (req.user.db.rank.mod === true) {
            next();
        } else {
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__("common.error.notMod"),
                req,
                type: "Error"
            });
        }
    } else auth(req, res, next);
};

export const assistant = (req: Request, res: Response, next: () => void) => {
    if (req.session.logoutJustCont === true) {
        req.session.logoutJust = false;
        req.session.logoutJustCont = false;
        return res.redirect("/");
    }

    if (req.user) {
        if (req.user.db.rank.assistant === true) {
            next();
        } else {
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__("common.error.notAssistant"),
                req,
                type: "Error"
            });
        }
    } else auth(req, res, next);
};

export const admin = (req: Request, res: Response, next: () => void) => {
    if (req.session.logoutJustCont === true) {
        req.session.logoutJust = false;
        req.session.logoutJustCont = false;
        return res.redirect("/");
    }

    if (req.user) {
        if (req.user.db.rank.admin === true) {
            next();
        } else {
            return res.status(403).render("status", {
                res,
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__("common.error.notAdmin"),
                req,
                type: "Error"
            });
        }
    } else auth(req, res, next);
};

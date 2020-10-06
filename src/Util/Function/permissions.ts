/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020 Cairo Mitchell-Acason, John Burke, Advaith Jagathesan

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

import { Request, Response } from "express";
import { bot, getMember } from "../Services/discord";
import * as settings from "../../../settings.json";
import * as discord from "../Services/discord";
import { DiscordAPIError } from "discord.js";

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

export const member = async (req: Request, res: Response, next: () => void) => {
    if (req.session.logoutJustCont === true) {
        req.session.logoutJust = false;
        req.session.logoutJustCont = false;
        return res.redirect("/");
    }

    if (!await getMember(req.body.id)) {
        discord.bot.api.guilds(settings.guild.main).members(req.user.id).put({ data: { access_token: req.user.accessToken } })
            .catch((error: DiscordAPIError) => {
                if (error.httpStatus === 403 && !req.user.impersonator) {
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [
                            res.__("common.error.failedJoin", {
                                a:
                                    '<a href="https://discord.gg/WeCer3J" rel="noopener" target="_blank">',
                                ea: "</a>"
                            })
                        ]
                    });
                } else next();
            });
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
                title: res.__("common.error"),
                status: 403,
                subtitle: res.__("common.error.notAdmin"),
                req,
                type: "Error"
            });
        }
    } else auth(req, res, next);
};

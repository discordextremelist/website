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
import { bot } from "../Services/discord";
import * as https from "https";
import * as settings from "../../../settings.json";

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

export const member = (req: Request, res: Response, next: () => void) => {
    if (req.session.logoutJustCont === true) {
        req.session.logoutJust = false;
        req.session.logoutJustCont = false;
        return res.redirect("/");
    }

    if (
        !bot.guilds.cache
            .get(settings.guild.main)
            .members.cache.get(req.user.id)
    ) {
        const data = JSON.stringify({
            access_token: req.user.accessToken
        });

        const options = {
            hostname: "discord.com",
            port: 443,
            path: `/api/v6/guilds/${settings.guild.main}/members/${req.user.id}`,
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": data.length,
                Authorization: "Bot " + settings.secrets.discord.token
            }
        };

        const msReq = https.request(options, (response) => {
            if (response.statusCode === 403 && !req.user.impersonator) {
                return res.status(403).render("status", {
                    title: res.__("common.error"),
                    status: 403,
                    subtitle: res.__("common.error.notMember"),
                    req,
                    type: "Error"
                });
            } else next();
        });

        msReq.on("error", (e) => {
            console.error(e);
        });

        msReq.write(data);
        msReq.end();
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

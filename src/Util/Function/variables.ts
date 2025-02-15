/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020-2024 Carolina Mitchell, John Burke, Advaith Jagathesan

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

import color from "color";
import settings from "../../../settings.json" assert { type: "json" };
import pkg from "../../../package.json" assert { type: "json" };
import * as announcementCache from "../Services/announcementCaching.js";
import * as userCache from "../Services/userCaching.js";
import * as banList from "../Services/banned.js";
import { URLSearchParams } from "url";
import { themes } from "../../../@types/enums.js";
import UAParser from "ua-parser-js";

export const variables = async (
    req: Request,
    res: Response,
    next: () => void
) => {
    try {
        if (req.query.setLang || req.query.localeLayout) {
            let params = new URLSearchParams(
                req.query as { setLang?: "t"; localeLayout?: "rtl" | "ltr" }
            );
            params.delete("setLang");
            params.delete("localeLayout");

            return res.redirect(
                req.baseUrl +
                    (req.path === "/" ? "" : req.path) +
                    (params.toString() && `?${params}`)
            );
        }

        res.locals.requestedAt = Date.now();
        res.locals.cssVersion = pkg.version;

        res.locals.linkPrefix = `/${
            req.locale || settings.website.locales.default
        }`;

        res.locals.defaultLang = settings.website.locales.default;
        res.locals.baseURL = settings.website.url;
        res.locals.dev = settings.website.dev;
        res.locals.announcement = announcementCache.getAnnouncement();

        res.locals.announcement.default = [
            "#3273dc",
            "#3298dc",
            "#0dbf04",
            "#f24405",
            "#cd0930",
            "preferred"
        ];

        if (
            !req.originalUrl.includes("/audio/") &&
            !req.originalUrl.includes("/auth/") &&
            !req.originalUrl.includes("/css/") &&
            !req.originalUrl.includes("/fonts/") &&
            !req.originalUrl.includes("/img/") &&
            !req.originalUrl.includes("/js/") &&
            !req.originalUrl.includes("/favicon.ico")
        )
            req.session.redirectTo = req.originalUrl;

        const version = pkg.version;
        req.del = {
            version,
            node: "Unavailable"
        };

        res.locals.colour = color;
        res.locals.premidPageInfo = "";
        res.locals.hideLogin = false;

        if (req.session.disableRTL && req.session.disableRTL === true) {
            res.locals.htmlDir = "ltr";
        } else
            settings.website.locales.isRTL.includes(req.locale)
                ? (res.locals.htmlDir = "rtl")
                : (res.locals.htmlDir = "ltr");

        settings.website.locales.isRTL.includes(req.locale)
            ? (req.session.rtlLanguage = true)
            : (req.session.rtlLanguage = false);

        res.locals.pageType = {
            server: false,
            bot: false,
            template: false,
            user: false
        };

        res.locals.socialMedia = {
            facebook: "https://facebook.com/DiscordExtremeList",
            twitter: "https://twitter.com/@ExtremeList",
            instagram: "https://www.instagram.com/discordextremelist/",
            github: "https://github.com/discordextremelist",
            patreon: "https://www.patreon.com/discordextremelist"
        };

        res.locals.discordServer = "https://discord.gg/WeCer3J";

        let useragent = new UAParser(
            req.headers["user-agent"] ||
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15"
        );

        if (useragent.getDevice().type === "tablet") {
            res.locals.mobile = true;
            res.locals.tablet = true;
        } else if (useragent.getDevice().type === "mobile") {
            res.locals.mobile = true;
            res.locals.phone = true;
        } else {
            res.locals.mobile = false;
            res.locals.phone = false;
            res.locals.tablet = false;
        }

        let theme = req.user?.db?.preferences?.theme;

        if (req.query.theme) theme = themes[req.query.theme as string];

        switch (theme) {
            case themes.dark:
                res.locals.preferredTheme = "dark";
                res.locals.siteThemeColour = "#131313";
                res.locals.siteThemeColourDarker = "#131313";
                res.locals.monacoTheme = "vs-dark";
                break;
            case themes.light:
                res.locals.preferredTheme = "light";
                res.locals.siteThemeColour = "#ECECEC";
                res.locals.siteThemeColourDarker = "#ECECEC";
                res.locals.monacoTheme = "vs-light";
                break;
            default:
                res.locals.preferredTheme = "black";
                res.locals.siteThemeColour = "#0e0e0e";
                res.locals.siteThemeColourDarker = "#000000";
                res.locals.monacoTheme = "vs-dark";
                break;
        }

        if (req.user) {
            let user: delUser;
            user = await userCache.getUser(req.user.id);

            if (!user) {
                user = await global.db
                    .collection<delUser>("users")
                    .findOne({ _id: req.user.id });
            }

            if (!user) {
                throw new Error("User not found");
            }

            req.user.db = user;

            const isBanned = await banList.check(req.user.id);
            if (isBanned) {
                res.status(403).render("banned", { req });
                return;
            }

            if (
                req.user.db.rank.mod === true &&
                req.url !== "/profile/game/snakes"
            ) {
                await global.db.collection("users").updateOne(
                    { _id: req.user.id },
                    {
                        $set: {
                            "staffTracking.lastAccessed.time": Date.now(),
                            "staffTracking.lastAccessed.page": req.originalUrl
                        }
                    }
                );
            }
        }

        req.session.logoutJust === true
            ? (req.session.logoutJustCont = true)
            : (req.session.logoutJustCont = false);
        req.session.logoutJust = false;

        res.locals.defaultColour = "#BA2EFF";
        res.locals.foreground = "#ffffff";

        if (req.user) {
            res.locals.defaultColour =
                req.user.db.preferences.defaultColour || "#BA2EFF";
            res.locals.foreground =
                req.user.db.preferences.defaultForegroundColour || "#ffffff";
        }

        if (!res.headersSent) {
            res.setHeader(
                "Content-Security-Policy",
                "default-src 'self' 'unsafe-inline' status.discordextremelist.xyz cdn.jsdelivr.net cdnjs.cloudflare.com js.sentry-cdn.com fonts.googleapis.com fonts.gstatic.com; img-src *;"
            );
            next();
        }
    } catch (error) {
        if (!res.headersSent) {
            next(error);
        }
    }
};

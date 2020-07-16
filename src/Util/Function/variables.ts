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

import browser from "browser-detect";
import color from "color";
import * as settings from "../../../settings.json";
import * as releaseInfo from "../../../release-info.json";
import * as announcementCache from "../Services/announcementCaching";
import * as banList from "../Services/banned";

export const variables = async (
    req: Request,
    res: Response,
    next: () => void
) => {
    if (req.originalUrl.includes("?setLang=t")) {
        return res.redirect(req.originalUrl.replace("?setLang=t", ""));
    }

    if (
        req.originalUrl.includes("?localeLayout=rtl") ||
        req.originalUrl.includes("?localeLayout=ltr")
    ) {
        let returnURL = req.originalUrl.replace("?localeLayout=rtl", "");
        returnURL = returnURL.replace("?localeLayout=ltr", "");
        return res.redirect(returnURL);
    }

    req.browser = browser(req.headers["user-agent"]);
    res.locals.browser = req.browser;
    res.locals.requestedAt = Date.now();
    res.locals.cssVersion = releaseInfo.cssVersion;
    res.locals.ddosMode = false; //ddosMode.getDDOSMode().active;
    res.locals.gaID = settings.website.gaID;

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

    req.session.redirectTo = req.originalUrl;
    req.del = releaseInfo;
    req.del.node = "us-node"; // will be updated in a bit:tm: (*cough* spoiler)
    res.locals.colour = color;
    res.locals.premidPageInfo = "";

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

    if (req.device.type === "tablet" || req.device.type === "phone") {
        res.locals.mobile = true;
        req.device.type === "phone"
            ? (res.locals.phone = true)
            : (res.locals.phone = false);
        req.device.type === "tablet"
            ? (res.locals.tablet = true)
            : (res.locals.tablet = false);
    } else {
        res.locals.mobile = false;
        res.locals.phone = false;
        res.locals.tablet = false;
    }

    if (
        req.browser.name === "firefox" ||
        (req.browser.name === "opera" &&
            req.browser.os === "Android" &&
            req.browser.versionNumber < 46) ||
        (req.browser.name === "safari" &&
            req.browser.versionNumber < 11.3 &&
            req.get("User-Agent").toLowerCase().includes("kaios"))
    ) {
        res.locals.usePreload = false;
    } else {
        res.locals.usePreload = true;
    }

    if (req.headers.accept && req.headers.accept.includes("image/webp")) {
        res.locals.imageFormat = "webp";
    } else {
        res.locals.imageFormat = "png";
    }

    res.locals.preferredTheme = "black";
    res.locals.siteThemeColour = "#0e0e0e";
    res.locals.siteThemeColourDarker = "#000000";

    if (req.user) {
        const user = await global.db
            .collection("users")
            .findOne({ _id: req.user.id });
        req.user.db = user;

        if (
            req.user.db.rank.mod === true &&
            req.url !== "/profile/game/snakes"
        ) {
            global.db.collection("users").updateOne(
                { _id: req.user.id },
                {
                    $set: {
                        "staffTracking.lastAccessed.time": Date.now(),
                        "staffTracking.lastAccessed.page": req.originalUrl
                    }
                }
            );
        }

        req.user.db.preferences.theme === 0 || !req.user.db.preferences.theme
            ? (res.locals.preferredTheme = "black")
            : (res.locals.preferredTheme = "dark");
        if (res.locals.preferredTheme === "dark") {
            res.locals.siteThemeColour = "#131313";
            res.locals.siteThemeColourDarker = "#131313";
        }

        const isBanned = await banList.check(req.user.id);
        if (isBanned) return res.status(403).render("banned", { req });
    }

    req.session.logoutJust === true
        ? (req.session.logoutJustCont = true)
        : (req.session.logoutJustCont = false);
    req.session.logoutJust = false;

    next();
};

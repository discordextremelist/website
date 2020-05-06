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

const browser = require("browser-detect");
const settings = require("../../../settings.json");
const releaseInfo = require("../../../release-info.json");

const variables = async(req, res, next) => {
    req.browser = browser(req.headers["user-agent"]);
    res.locals.browser = req.browser;
    res.locals.requestedAt = Date.now();
    res.locals.gaID = settings.website.gaID;
    req.session.redirectTo = req.originalUrl;
    req.del = releaseInfo;
    req.del.node = "us-node"; // will be updated in a bit:tm: (*cough* spoiler)

    res.locals.pageType = {
        server: false,
        bot: false
    }

    res.locals.socialMedia = {
        facebook: "https://facebook.com/DiscordExtremeList",
        twitter: "https://twitter.com/@ExtremeList",
        instagram: "https://www.instagram.com/discordextremelist/",
        github: "https://github.com/discordextremelist"
    }

    res.locals.discordServer = "https://discord.gg/WeCer3J";

    if (req.device.type === "tablet" || req.device.type === "phone") {
        res.locals.mobile = true;
    } else {
        res.locals.mobile = false;
    }

    if (req.browser.name === "firefox" || req.browser.name === "opera" && req.browser.os === "Android" && req.browser.versionNumber < 46 || req.browser.name === "safari" && req.browser.versionNumber < 11.3 && req.get("User-Agent").toLowerCase().includes("kaios")) {
        usePreload = false;
    } else {
        usePreload = true;
    }

    if (req.headers.accept.includes("image/webp") === true) {
        res.locals.imageFormat = "webp";
    } else {
        res.locals.imageFormat = "png";
    }

    if (req.user) {
        const user = await req.app.db.collection("users").findOne({ id: req.user.id });
        req.user.db = user;
        
        if (req.user.db.rank.mod === true && req.url !== "/profile/game/snakes") {
            req.app.db.collection("users").updateOne({ id: req.user.id }, 
                { $set: {
                    "staffTracking.lastAccessed.time": Date.now(),
                    "staffTracking.lastAccessed.page": req.originalUrl
                }
            });
        }
    }

    next();
}

module.exports = variables;
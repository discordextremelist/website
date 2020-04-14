const browser = require("browser-detect");
const releaseInfo = require("../../../release-info.json");

const variables = async(req, res, next) => {
    req.browser = browser(req.headers["user-agent"]);
    res.locals.browser = req.browser;
    res.locals.requestedAt = Date.now();
    req.session.redirectTo = req.originalUrl;
    req.del = releaseInfo;
    req.del.node = "node-us"; // will be updated in a bit:tm: (*cough* spoiler)
    
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
        usePreload = true;
    } else {
        usePreload = false;
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
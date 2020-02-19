const browser = require("browser-detect");

const variables = (req, res, next) => {
    req.browser = browser(req.headers["user-agent"]);
    res.locals.browser = req.browser;
    res.locals.requestedAt = Date.now();
    req.session.redirectTo = req.originalUrl;
    
    res.locals.pageType = {
        home: false,
        standard: true,
        server: false,
        bot: false
    }

    res.locals.socialMedia = {
        facebook: "https://facebook.com/DiscordExtremeList",
        twitter: "https://twitter.com/@ExtremeList",
        instagram: "https://www.instagram.com/discordextremelist/",
        gitlab: "https://gitlab.com/discordextremelist"
    }

    res.locals.discordServer = "https://discord.gg/WeCer3J";

    if (req.headers.accept.includes("image/webp") === true) {
        res.locals.imageFormat = "webp";
    } else {
        res.locals.imageFormat = "png";
    }

    next();
}

module.exports = variables;
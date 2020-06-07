const settings = require("../../../settings.json");

const homeHandler = (req, res, next) => {
    if (req.params.lang && !settings.website.locales.isntLocale.includes(req.params.lang)) {
        if (settings.website.locales.all.includes(req.params.lang)) {
            if (req.query.setLang && req.query.setLang === "t") {
                req.session.delLang = req.params.lang
                req.setLocale(req.params.lang);
                next();
            } else if (req.query.localeLayout) { 
                req.query.localeLayout === "ltr" ? req.session.disableRTL = true : req.session.disableRTL = false;
                req.setLocale(req.params.lang);
                next();
            } else if (req.session.delLang && req.params.lang !== req.session.delLang) {
                res.redirect(307, req.originalUrl.replace(req.params.lang, req.session.delLang));
            } else {
                req.session.delLang = req.params.lang
                req.setLocale(req.params.lang);
                next();
            }
        } else {
            if (req.session.delLang) {
                res.redirect(307, req.originalUrl.replace(req.params.lang, req.session.delLang));
            } else {
                res.redirect(307, req.originalUrl.replace(req.params.lang, settings.website.locales.default));
            }
        }
    } else if (settings.website.locales.isntLocale.includes(req.params.lang)) {
        if (req.session.delLang) {
            res.redirect(307, `/${req.session.delLang}${req.originalUrl}`);
        } else {
            res.redirect(307, `/${settings.website.locales.default}${req.originalUrl}`);
        }
    } else {
        if (req.session.delLang) {
            res.redirect(307, `/${req.session.delLang}`);
        } else {
            res.redirect(307, `/${settings.website.locales.default}`);
        }
    }
}; 

const globalHandler = (req, res, next) => {
    if (req.params.lang && !settings.website.locales.isntLocale.includes(req.params.lang)) {
        if (settings.website.locales.all.includes(req.params.lang)) {
            if (req.query.setLang && req.query.setLang === "t") {
                req.session.delLang = req.params.lang
                req.setLocale(req.params.lang);
                next();
            } else if (req.query.localeLayout) { 
                req.query.localeLayout === "ltr" ? req.session.disableRTL = true : req.session.disableRTL = false;
                req.setLocale(req.params.lang);
                next();
            } else if (req.session.delLang && req.params.lang !== req.session.delLang) {
                res.redirect(307, req.originalUrl.replace(req.params.lang, req.session.delLang));
            } else {
                req.session.delLang = req.params.lang
                req.setLocale(req.params.lang);
                next();
            }
        } else {
            if (req.session.delLang) {
                res.redirect(req.originalUrl.replace(req.params.lang, req.session.delLang));
            } else {
                res.redirect(req.originalUrl.replace(req.params.lang, settings.website.locales.default));
            }
        }
    } else {
        if (req.session.delLang) {
            res.redirect(`/${req.session.delLang}${req.originalUrl}`);
        } else {
            res.redirect(`/${settings.website.locales.default}${req.originalUrl}`);
        }
    }
};

module.exports = {
    homeHandler,
    globalHandler
}
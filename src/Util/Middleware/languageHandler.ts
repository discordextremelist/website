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
import * as settings from "../../../settings.json";

export const homeHandler = (req: Request, res: Response, next: () => void) => {
    if (
        req.params.lang &&
        !settings.website.locales.isntLocale.includes(req.params.lang)
    ) {
        if (settings.website.locales.all.includes(req.params.lang)) {
            if (req.query.setLang && req.query.setLang === "t") {
                req.session.delLang = req.params.lang;
                req.setLocale(req.params.lang);
                next();
            } else if (req.query.localeLayout) {
                req.query.localeLayout === "ltr"
                    ? (req.session.disableRTL = true)
                    : (req.session.disableRTL = false);
                req.setLocale(req.params.lang);
                next();
            } else if (
                req.session.delLang &&
                req.params.lang !== req.session.delLang
            ) {
                res.redirect(
                    307,
                    req.originalUrl.replace(
                        req.params.lang,
                        req.session.delLang
                    )
                );
            } else {
                req.session.delLang = req.params.lang;
                req.setLocale(req.params.lang);
                next();
            }
        } else {
            if (req.session.delLang) {
                res.redirect(
                    307,
                    req.originalUrl.replace(
                        req.params.lang,
                        req.session.delLang
                    )
                );
            } else {
                res.redirect(
                    307,
                    req.originalUrl.replace(
                        req.params.lang,
                        settings.website.locales.default
                    )
                );
            }
        }
    } else if (settings.website.locales.isntLocale.includes(req.params.lang)) {
        if (req.session.delLang) {
            res.redirect(307, `/${req.session.delLang}${req.originalUrl}`);
        } else {
            res.redirect(
                307,
                `/${settings.website.locales.default}${req.originalUrl}`
            );
        }
    } else {
        if (req.session.delLang) {
            res.redirect(307, `/${req.session.delLang}`);
        } else {
            res.redirect(307, `/${settings.website.locales.default}`);
        }
    }
};

export const globalHandler = (
    req: Request,
    res: Response,
    next: () => void
) => {
    if (
        req.params.lang &&
        !settings.website.locales.isntLocale.includes(req.params.lang)
    ) {
        if (settings.website.locales.all.includes(req.params.lang)) {
            if (req.query.setLang && req.query.setLang === "t") {
                req.session.delLang = req.params.lang;
                req.setLocale(req.params.lang);
                next();
            } else if (req.query.localeLayout) {
                req.query.localeLayout === "ltr"
                    ? (req.session.disableRTL = true)
                    : (req.session.disableRTL = false);
                req.setLocale(req.params.lang);
                next();
            } else if (
                req.session.delLang &&
                req.params.lang !== req.session.delLang
            ) {
                res.redirect(
                    307,
                    req.originalUrl.replace(
                        req.params.lang,
                        req.session.delLang
                    )
                );
            } else {
                req.session.delLang = req.params.lang;
                req.setLocale(req.params.lang);
                next();
            }
        } else {
            if (req.session.delLang) {
                res.redirect(
                    req.originalUrl.replace(
                        req.params.lang,
                        req.session.delLang
                    )
                );
            } else {
                res.redirect(
                    req.originalUrl.replace(
                        req.params.lang,
                        settings.website.locales.default
                    )
                );
            }
        }
    } else {
        if (req.session.delLang) {
            res.redirect(`/${req.session.delLang}${req.originalUrl}`);
        } else {
            res.redirect(
                `/${settings.website.locales.default}${req.originalUrl}`
            );
        }
    }
};

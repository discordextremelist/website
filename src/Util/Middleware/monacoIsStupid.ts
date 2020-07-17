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

export const monacoIsStupid = (
    req: Request,
    res: Response,
    next: () => void
) => {
    if (
        req.originalUrl.includes("/vs/language/css/cssMode.js") &&
        !req.originalUrl.includes(
            `${settings.website.url}packages/monaco-editor/min/vs/basic-languages/css/css.js`
        )
    ) {
        return res.redirect(
            `${settings.website.url}/packages/monaco-editor/min/vs/language/css/cssMode.js`
        );
    } else if (
        req.originalUrl.includes("/vs/base/worker/workerMain.js") &&
        !req.originalUrl.includes(
            `${settings.website.url}packages/monaco-editor/min/vs/base/worker/workerMain.js`
        )
    ) {
        return res.redirect(
            `${settings.website.url}/packages/monaco-editor/min/vs/base/worker/workerMain.js`
        );
    } else if (
        req.originalUrl.includes("/vs/editor/editor.main.css") &&
        !req.originalUrl.includes(
            `${settings.website.url}packages/monaco-editor/min/vs/editor/editor.main.css`
        )
    ) {
        return res.redirect(
            `${settings.website.url}/packages/monaco-editor/min/vs/editor/editor.main.css`
        );
    } else if (
        req.originalUrl.includes("/vs/editor/editor.main.js") &&
        !req.originalUrl.includes(
            `${settings.website.url}packages/monaco-editor/min/vs/editor/editor.main.js`
        )
    ) {
        return res.redirect(
            `${settings.website.url}/packages/monaco-editor/min/vs/editor/editor.main.js`
        );
    } else if (
        req.originalUrl.includes("/vs/editor/editor.main.nls.js") &&
        !req.originalUrl.includes(
            `${settings.website.url}packages/monaco-editor/min/vs/editor/editor.main.nls.js`
        )
    ) {
        return res.redirect(
            `${settings.website.url}/packages/monaco-editor/min/vs/editor/editor.main.nls.js`
        );
    } else if (
        req.originalUrl.includes("/vs/loader.js") &&
        !req.originalUrl.includes(
            `${settings.website.url}packages/monaco-editor/min/vs/loader.js`
        )
    ) {
        return res.redirect(
            `${settings.website.url}/packages/monaco-editor/min/vs/loader.js`
        );
    } else if (
        req.originalUrl.includes("/vs/basic-languages/markdown/markdown.js") &&
        !req.originalUrl.includes(
            `${settings.website.url}packages/monaco-editor/min/vs/basic-languages/markdown/markdown.js`
        )
    ) {
        return res.redirect(
            `${settings.website.url}/packages/monaco-editor/min/vs/basic-languages/markdown/markdown.js`
        );
    } else if (
        req.originalUrl.includes("/vs/basic-languages/css/css.js") &&
        !req.originalUrl.includes(
            `${settings.website.url}packages/monaco-editor/min/vs/basic-languages/css/css.js`
        )
    ) {
        return res.redirect(
            `${settings.website.url}/packages/monaco-editor/min/vs/basic-languages/css/css.js`
        );
    } else {
        next();
    }
};

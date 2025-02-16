/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020-2025 Carolina Mitchell, John Burke, Advaith Jagathesan

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

import type { Request, Response } from "express";

export const monacoRedirect = (
    req: Request,
    res: Response,
    next: () => void
) => {
    if (req.originalUrl.includes("/vs/basic-languages/markdown/markdown.js")) {
        return res.redirect(
            "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.20.0/min/vs/basic-languages/markdown/markdown.min.js"
        );
    } else if (req.originalUrl.includes("/vs/basic-languages/html/html.js")) {
        return res.redirect(
            "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.20.0/min/vs/basic-languages/html/html.min.js"
        );
    } else if (req.originalUrl.includes("/vs/language/html/htmlMode.js")) {
        return res.redirect(
            "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.20.0/min/vs/language/html/htmlMode.min.js"
        );
    } else if (req.originalUrl.includes("/vs/basic-languages/css/css.js")) {
        return res.redirect(
            "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.20.0/min/vs/basic-languages/css/css.min.js"
        );
    } else if (req.originalUrl.includes("/vs/language/css/cssMode.js")) {
        return res.redirect(
            "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.20.0/min/vs/language/css/cssMode.min.js"
        );
    } else if (
        req.originalUrl.includes("/vs/basic-languages/javascript/javascript.js")
    ) {
        return res.redirect(
            "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.20.0/min/vs/basic-languages/javascript/javascript.min.js"
        );
    } else if (req.originalUrl.includes("/vs/language/typescript/tsMode.js")) {
        return res.redirect(
            "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.20.0/min/vs/language/typescript/tsMode.min.js"
        );
    } else {
        next();
    }
};

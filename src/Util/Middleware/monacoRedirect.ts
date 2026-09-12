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

// Monaco loads its language workers and grammars from our own origin. Send
// those requests to the matching minified files on cdnjs. Checked in order,
// and a request goes to the first entry its URL contains.
const CDN = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.20.0/min";
const MONACO_FILES = [
    "/vs/basic-languages/markdown/markdown.js",
    "/vs/basic-languages/html/html.js",
    "/vs/language/html/htmlMode.js",
    "/vs/basic-languages/css/css.js",
    "/vs/language/css/cssMode.js",
    "/vs/basic-languages/javascript/javascript.js",
    "/vs/language/typescript/tsMode.js"
];

export const monacoRedirect = (
    req: Request,
    res: Response,
    next: () => void
) => {
    const file = MONACO_FILES.find((f) => req.originalUrl.includes(f));
    if (file) return res.redirect(CDN + file.replace(/\.js$/, ".min.js"));
    next();
};

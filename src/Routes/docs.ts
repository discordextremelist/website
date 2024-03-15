/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020 Carolina Mitchell, John Burke, Advaith Jagathesan

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

import express from "express";
import type { Request, Response } from "express";

import settings from "../../settings.json" assert { type: "json" };
import { variables } from "../Util/Function/variables.js";

const router = express.Router();

router.get("/", variables, async (req: Request, res: Response, next) => {
    res.locals.premidPageInfo = res.__("premid.docs");

    res.render("templates/docs/index", {
        title: res.__("common.nav.more.docs"),
        subtitle: res.__("docs.subtitle"),
        req,
        settings,
        tableTdThClr: ["dark", "black"].includes(res.locals.preferredTheme)
            ? "whitesmoke"
            : "#000000"
    });
});

export default router;

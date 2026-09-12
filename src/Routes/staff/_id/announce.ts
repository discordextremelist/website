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

import { AuthedPathRoute } from "../../route.ts";
import type { Response } from "express";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as functions from "../../../Util/Function/main.ts";
import * as announcementCache from "../../../Util/Services/announcementCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";

export class GetAnnounce extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/announce", [variables, permission.assistant]);
    }

    async handle(req: AuthedRequest, res: Response) {
        res.locals.premidPageInfo = res.__("premid.staff.announcer");

        res.render("templates/staff/announce", {
            title: res.__("page.staff.announcer"),
            subtitle: res.__("page.staff.announcer.subtitle"),
            req: req
        });
    }
}

export class PostAnnounce extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/announce", [variables, permission.assistant]);
    }

    async handle(req: AuthedRequest, res: Response) {
        let foreground: string;
        let colour: string = req.body.colour;

        if (req.body.colour === "preferred") {
            foreground = "preferred";
        } else if (req.body.colour === "custom") {
            colour = req.body.customColour;
            foreground = functions.getForeground(req.body.customColour);
        } else {
            foreground = functions.getForeground(req.body.colour);
        }

        await announcementCache.updateAnnouncement(
            {
                active: true,
                message: req.body.message,
                colour: colour,
                foreground: foreground
            },
            req
        );

        res.render("templates/staff/announceWithNotif", {
            title: res.__("page.staff.announcer"),
            subtitle: res.__("page.staff.announcer.subtitle"),
            req: req,
            notification: res.__("page.staff.announcer.setSuccess")
        });
    }
}

export class ResetAnnounce extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/announce/reset", [variables, permission.assistant]);
    }

    async handle(req: AuthedRequest, res: Response) {
        await announcementCache.updateAnnouncement(
            {
                active: false,
                message: "",
                colour: "",
                foreground: ""
            },
            req
        );

        res.render("templates/staff/announceWithNotif", {
            title: res.__("page.staff.announcer"),
            subtitle: res.__("page.staff.announcer.subtitle"),
            req: req,
            notification: res.__("page.staff.announcer.resetSuccess")
        });
    }
}

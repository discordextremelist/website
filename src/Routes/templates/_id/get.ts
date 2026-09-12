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

import { PathRoute } from "../../route.ts";
import type { Request, Response } from "express";
import sanitizeHtml from "sanitize-html";
import settings from "../../../../settings.json" with { type: "json" };
import htmlRef from "../../../../htmlReference.json" with { type: "json" };
import * as functions from "../../../Util/Function/main.ts";
import * as userCache from "../../../Util/Services/userCaching.ts";
import * as templateCache from "../../../Util/Services/templateCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import mdi from "markdown-it";
import entities from "html-entities";
import { renderStatus } from "../../../Util/Function/main.ts";

const md = new mdi();

export class GetTemplate extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id", [variables]);
    }

    async handle(req: Request, res: Response) {
        res.locals.pageType = {
            server: false,
            bot: false,
            template: true
        };

        let template: delTemplate | undefined = await templateCache.getTemplate(
            req.params.id
        );
        if (!template) {
            template = await global.db
                .collection<delTemplate>("templates")
                .findOne({ _id: req.params.id });
            if (!template)
                return renderStatus(
                    req,
                    res,
                    404,
                    res.__("common.error.template.404"),
                    { pageType: { template: false, bot: false, server: false } }
                );
        }

        res.locals.premidPageInfo = res.__(
            "premid.templates.view",
            template.name
        );

        let templateOwner: delUser | undefined = await userCache.getUser(
            template.owner.id
        );
        if (!templateOwner) {
            templateOwner = await global.db
                .collection<delUser>("users")
                .findOne({ _id: template.owner.id });
        }

        const dirty = entities.decode(md.render(template.longDesc));
        let clean: string;
        clean = sanitizeHtml(dirty, {
            allowedTags: htmlRef.minimal.tags,
            allowedAttributes: htmlRef.minimal.attributes,
            allowVulnerableTags: true
        });

        res.render("templates/serverTemplates/view", {
            title: `${template.name} | ${res.__("common.templates.discord")}`,
            subtitle: template.shortDesc,
            template,
            longDesc: clean,
            templateOwner,
            creatorHasProfile: !!(
                template.creator &&
                (await userCache.getUser(template.creator.id))
            ),
            webUrl: settings.website.url,
            req,
            functions
        });
    }
}

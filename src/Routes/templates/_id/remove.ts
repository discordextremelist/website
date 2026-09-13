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
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../../Util/Services/discord/index.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import { escapeFormatting } from "../../../Util/Function/common/format.ts";
import * as templateCache from "../../../Util/Services/cache/templateCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import { templateType } from "../../../Util/Function/staff/audit.ts";
import { templateExists } from "../../../Util/Middleware/checks.ts";
import { logListingEvent } from "../../../Util/Function/listings/websiteLog.ts";
import { reasonMissing } from "../../../Util/Function/staff/staffActions.ts";

export class GetRemoveTemplate extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/remove", [
            variables,
            permission.auth,
            permission.mod,
            templateExists
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const template: delTemplate | undefined = req.attached.template!;

        res.locals.premidPageInfo = res.__(
            "premid.templates.remove",
            template.name
        );

        res.render("templates/serverTemplates/staffActions/remove", {
            title: res.__("page.templates.remove.title"),
            subtitle: res.__("page.templates.remove.subtitle", template.name),
            removingTemplate: template,
            req
        });
    }
}

export class PostRemoveTemplate extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/remove", [
            variables,
            permission.auth,
            permission.mod,
            templateExists
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const template: delTemplate | undefined = req.attached.template!;

        if (reasonMissing(req, res)) return;

        await global.db
            .collection("templates")
            .deleteOne({ _id: req.params.id });

        const type = templateType(req.body.type);

        await global.db.collection("audit").insertOne({
            type: "REMOVE_TEMPLATE",
            executor: req.user.id,
            target: req.params.id,
            date: Date.now(),
            reason: req.body.reason || "None specified.",
            reasonType: type
        });

        await templateCache.deleteTemplate(req.params.id);

        await logListingEvent(req, "template", "removed", template, {
            reason: req.body.reason
        });

        await discord.messageMember(
            template.owner.id,
            `${settings.emoji.delete} **|** Your template **${escapeFormatting(
                template.name
            )}** \`(${template._id})\` has been removed!\n**Reason:** \`${
                req.body.reason || "None specified."
            }\``
        );

        await discord.postWebMetric("template");

        res.redirect("/templates");
    }
}

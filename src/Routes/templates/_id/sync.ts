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
import * as discord from "../../../Util/Services/discord/index.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as templateCache from "../../../Util/Services/cache/templateCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import type { APITemplate, DiscordAPIError } from "discord.js";
import { RESTJSONErrorCodes, Routes } from "discord.js";
import { discordErrorPage } from "../../../Util/Function/web/responses.ts";
import { templateExists } from "../../../Util/Middleware/checks.ts";
import {
    syncedTemplateAuditBefore,
    syncedTemplateFields
} from "../../../Util/Function/templates/templateRecords.ts";

export class SyncTemplate extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/sync", [variables, permission.auth, templateExists]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const dbTemplate: delTemplate | undefined = req.attached.template!;

        await discord
            .restGet<APITemplate>(Routes.template(req.params.id))
            .then(async (template: APITemplate) => {
                await global.db.collection("templates").updateOne(
                    { _id: req.params.id },
                    {
                        $set: syncedTemplateFields(template)
                    }
                );

                await global.db.collection("audit").insertOne({
                    type: "SYNC_TEMPLATE",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        new: syncedTemplateFields(template),
                        old: syncedTemplateAuditBefore(template, dbTemplate)
                    }
                });

                await templateCache.updateTemplate(req.params.id);

                res.redirect(`/templates/${req.params.id}`);
            })
            .catch((error: DiscordAPIError) =>
                discordErrorPage(
                    req,
                    res,
                    error,
                    RESTJSONErrorCodes.UnknownGuildTemplate,
                    res.__("common.error.template.arr.invite.invalid")
                )
            );
    }
}

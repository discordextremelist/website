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
import { listingCodeError } from "../../../Util/Function/listings/listingCode.ts";
import * as templateCache from "../../../Util/Services/cache/templateCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import type { APITemplate, DiscordAPIError } from "discord.js";
import { RESTJSONErrorCodes, Routes } from "discord.js";
import {
    templateExists,
    templateExistsJson
} from "../../../Util/Middleware/checks.ts";
import { sanitizeMinimalHtmlEscaped } from "../../../Util/Function/web/sanitize.ts";
import { logListingEvent } from "../../../Util/Function/listings/websiteLog.ts";
import { communityTags } from "../../../Util/Function/servers/serverListing.ts";
import {
    discordErrorJson,
    jsonError,
    jsonOk
} from "../../../Util/Function/web/responses.ts";
import {
    editedTemplateAuditAfter,
    editedTemplateAuditBefore,
    editedTemplateFields
} from "../../../Util/Function/templates/templateRecords.ts";
import { recordAudit } from "../../../Util/Function/staff/recordAudit.ts";

export class GetEditTemplate extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/edit", [
            variables,
            permission.auth,
            templateExists,
            permission.ownerOrAssistant(
                "template",
                "common.error.template.perms.edit"
            )
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const template: delTemplate | undefined = req.attached.template!;

        res.locals.premidPageInfo = res.__(
            "premid.templates.edit",
            template.name
        );

        const clean = sanitizeMinimalHtmlEscaped(template.longDesc);

        res.render("templates/serverTemplates/edit", {
            title: res.__("page.templates.edit.title"),
            subtitle: res.__("page.templates.edit.subtitle", template.name),
            req,
            template,
            longDesc: clean
        });
    }
}

export class PostEditTemplate extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/edit", [
            variables,
            permission.auth,
            templateExistsJson,
            permission.ownerOrAssistant(
                "template",
                "common.error.template.perms.edit",
                { json: true }
            )
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        let error = false;
        let errors = [];

        const dbTemplate: delTemplate = req.attached.template!;

        res.locals.premidPageInfo = res.__(
            "premid.templates.edit",
            dbTemplate.name
        );

        const codeError = listingCodeError(
            req.body.code,
            res,
            "template",
            2000
        );
        if (codeError) {
            error = true;
            errors.push(codeError);
        }

        let linkToServerPage = false;
        if (req.body.ltsp === "on") linkToServerPage = true;

        if (!req.body.shortDescription) {
            error = true;
            errors.push(res.__("common.error.listing.arr.shortDescRequired"));
        } else if (req.body.shortDescription.length > 200) {
            error = true;
            errors.push(res.__("common.error.listing.arr.shortDescTooLong"));
        }

        let tags: string[] = communityTags(req.body);

        if (error === true) return jsonError(res, 400, errors);

        await discord
            .restGet<APITemplate>(Routes.template(req.body.code))
            .then(async (template: APITemplate) => {
                await global.db.collection("templates").updateOne(
                    { _id: req.params.id },
                    {
                        $set: editedTemplateFields(
                            req,
                            template,
                            dbTemplate,
                            tags,
                            linkToServerPage
                        )
                    }
                );

                await logListingEvent(req, "template", "edited", {
                    _id: template.code,
                    name: template.name
                });

                await recordAudit({
                    type: "EDIT_TEMPLATE",
                    executor: req.user.id,
                    target: req.params.id,
                    reason: "None specified.",
                    details: {
                        new: editedTemplateAuditAfter(
                            req,
                            template,
                            dbTemplate,
                            tags,
                            linkToServerPage
                        ),
                        old: editedTemplateAuditBefore(
                            template,
                            dbTemplate,
                            linkToServerPage
                        )
                    }
                });

                await templateCache.updateTemplate(req.params.id);

                return jsonOk(res, { id: template.code });
            })
            .catch((error: DiscordAPIError) =>
                discordErrorJson(
                    res,
                    error,
                    RESTJSONErrorCodes.UnknownGuildTemplate,
                    res.__("common.error.template.arr.invite.invalid")
                )
            );
    }
}

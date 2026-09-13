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

import { AuthedPathRoute } from "../route.ts";
import type { Response } from "express";
import * as discord from "../../Util/Services/discord/index.ts";
import * as permission from "../../Util/Middleware/permissions.ts";
import { listingCodeError } from "../../Util/Function/listings/listingCode.ts";
import * as templateCache from "../../Util/Services/cache/templateCaching.ts";
import { variables } from "../../Util/Middleware/variables.ts";
import type { APITemplate, DiscordAPIError } from "discord.js";
import { RESTJSONErrorCodes, Routes } from "discord.js";
import { logListingEvent } from "../../Util/Function/listings/websiteLog.ts";
import { communityTags } from "../../Util/Function/servers/serverListing.ts";
import {
    discordErrorJson,
    jsonError
} from "../../Util/Function/web/responses.ts";
import { submittedTemplate } from "../../Util/Function/templates/templateRecords.ts";
import { recordAudit } from "../../Util/Function/staff/recordAudit.ts";

export class GetSubmitTemplate extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/submit", [variables, permission.auth]);
    }

    handle(req: AuthedRequest, res: Response) {
        res.locals.premidPageInfo = res.__("premid.templates.submit");

        res.render("templates/serverTemplates/submit", {
            title: res.__("common.nav.me.submitTemplate"),
            subtitle: res.__("common.nav.me.submitTemplate.subtitle"),
            req
        });
    }
}

export class PostSubmitTemplate extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/submit", [variables, permission.auth]);
    }

    async handle(req: AuthedRequest, res: Response) {
        res.locals.premidPageInfo = res.__("premid.templates.submit");

        let error = false;
        let errors: string[] = [];

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

        const templateExists: delTemplate | null = await global.db
            .collection<delTemplate>("templates")
            .findOne({ _id: req.body.code });
        if (templateExists)
            return jsonError(res, 409, [
                res.__("common.error.template.conflict")
            ]);

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
                await global.db
                    .collection<delTemplate>("templates")
                    .insertOne(submittedTemplate(req, template, tags));

                await logListingEvent(req, "template", "added", {
                    _id: template.code,
                    name: template.name
                });

                await recordAudit({
                    type: "SUBMIT_TEMPLATE",
                    executor: req.user.id,
                    reason: "None specified.",
                    details: {
                        new: submittedTemplate(req, template, tags)
                    }
                });

                await templateCache.updateTemplate(template.code);

                await discord.postWebMetric("template");

                return res.status(200).json({
                    error: false,
                    status: 200,
                    errors: [],
                    id: template.code
                });
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

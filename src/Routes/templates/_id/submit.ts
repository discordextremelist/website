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
import * as discord from "../../../Util/Services/discord.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import { listingCodeError } from "../../../Util/Function/listingCode.ts";
import * as templateCache from "../../../Util/Services/templateCaching.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import type { APITemplate, DiscordAPIError } from "discord.js";
import { RESTJSONErrorCodes, Routes } from "discord.js";
import { logWebsiteAction } from "../../../Util/Function/websiteLog.ts";
import { communityTags } from "../../../Util/Function/serverListing.ts";
import {
    discordErrorJson,
    jsonError
} from "../../../Util/Function/responses.ts";
import { submittedTemplate } from "../../../Util/Function/templateRecords.ts";

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

                await logWebsiteAction(
                    req,
                    settings.emoji.add,
                    "added template",
                    template.name,
                    template.code,
                    {
                        suffix: `\n<${settings.website.url}/templates/${template.code}>`
                    }
                );

                await global.db.collection("audit").insertOne({
                    type: "SUBMIT_TEMPLATE",
                    executor: req.user.id,
                    date: Date.now(),
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

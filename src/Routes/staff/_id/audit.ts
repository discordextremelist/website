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
import { auditUserIDParse } from "../../../Util/Function/staff/audit.ts";
import * as functions from "../../../Util/Function/web/viewHelpers.ts";
import { variables } from "../../../Util/Middleware/variables.ts";

export class AuditLog extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/audit", [variables, permission.assistant]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const audit_type = req.query.t ?? "ALL";
        console.log(audit_type);
        // Read from the database, like main: the Redis audit cache is only
        // filled in development. String() stops ?t[$ne]=… reaching the query.
        const logs: auditLog[] = await global.db
            .collection<auditLog>("audit")
            .find(
                audit_type === "ALL"
                    ? { type: { $ne: "GAME_HIGHSCORE_UPDATE" } }
                    : { type: String(audit_type) }
            )
            .sort({ date: -1 })
            .allowDiskUse()
            .toArray();

        if (!req.query.page) req.query.page = "1";

        let iteratedLogs: auditLog[] = logs.slice(
            15 * Number(req.query.page) - 15,
            15 * Number(req.query.page)
        );

        for (const log of iteratedLogs) {
            log.executor = await auditUserIDParse(log.executor);
            log.target = await auditUserIDParse(log.target);
        }

        res.locals.premidPageInfo = res.__("premid.staff.audit");
        res.render("templates/staff/audit", {
            title: res.__("page.staff.audit"),
            subtitle: res.__("page.staff.audit.subtitle"),
            audit_type,
            req,
            logs,
            logsPgArr: iteratedLogs,
            page: req.query.page,
            pageParam: `?t=${audit_type}&page=`,
            pages: Math.ceil(logs.length / 15),
            functions
        });
    }
}

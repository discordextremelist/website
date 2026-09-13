import { AuthedPathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import {
    admin,
    adminToken,
    auth
} from "../../../Util/Middleware/permissions.ts";
import e from "express";
import * as botCache from "../../../Util/Services/cache/botCaching.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import { sendSource } from "../../../Util/Function/adminSource.ts";
import { sendReport } from "../../../Util/Function/report.ts";

export class SrcRoute extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/src", [variables, auth, admin, adminToken]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        return sendSource(req, res, "bots", botCache.getBot);
    }
}

export class ReportRoute extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/:id/report", [variables, auth, botExists]);
    }

    async handle(req: AuthedRequest, res: e.Response, next: e.NextFunction) {
        return sendReport(req, res, req.attached.bot!, "bot");
    }
}

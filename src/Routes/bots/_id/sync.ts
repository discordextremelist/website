import { AuthedPathRoute } from "../../route.ts";
import {
    type APIApplication,
    type APIApplicationCommand,
    type DiscordAPIError,
    RESTJSONErrorCodes
} from "discord.js";
import * as discord from "../../../Util/Services/discord.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";
import * as e from "express";
import { variables } from "../../../Util/Middleware/variables.ts";
import { auth } from "../../../Util/Middleware/permissions.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import {
    discordErrorJson,
    jsonError
} from "../../../Util/Function/responses.ts";
import {
    fetchSlashCommands,
    fetchUserFlags
} from "../../../Util/Function/botListing.ts";

export class SyncBot extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/:id/sync", [variables, auth, botExists]);
    }

    async handle(
        req: AuthedRequest,
        res: e.Response,
        next: e.NextFunction
    ): Promise<void> {
        const bot = req.attached.bot!;
        const commands: APIApplicationCommand[] = await fetchSlashCommands(
            req.user.db,
            bot.scopes?.slashCommands,
            bot._id,
            bot.commands || [],
            // The body sync has always sent: errors holds one list of one message.
            (message) => jsonError(res, 500, [[message]])
        );

        const userFlags = await fetchUserFlags(bot.scopes?.bot, bot._id);

        discord
            .restGet<APIApplication>(
                `/applications/${bot.clientID || req.params.id}/rpc`
            )
            .then(async (app: APIApplication) => {
                if (app.bot_public === false)
                    // not !app.bot_public; should not trigger when undefined
                    return jsonError(res, 400, [
                        res.__("common.error.bot.arr.notPublic")
                    ]);

                await global.db.collection("bots").updateOne(
                    { _id: req.params.id },
                    {
                        $set: {
                            name: app.name,
                            icon: {
                                hash: app.icon,
                                url: `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}`
                            },
                            commands,
                            userFlags
                        } satisfies Partial<delBot>
                    }
                );

                await global.db.collection("audit").insertOne({
                    type: "SYNC_BOT",
                    executor: req.user.id,
                    target: req.params.id,
                    date: Date.now(),
                    reason: "None specified.",
                    details: {
                        old: {
                            name: bot.name,
                            // Older bots only have the deprecated avatar; the
                            // bot page falls back to it, so record that.
                            icon: bot.icon ?? bot.avatar,
                            commands: bot.commands
                        } satisfies Partial<delBot>,
                        new: {
                            name: app.name,
                            icon: {
                                hash: app.icon,
                                url: `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}`
                            },
                            commands
                        } satisfies Partial<delBot>
                    }
                });

                await botCache.updateBot(req.params.id);

                res.redirect(`/bots/${bot._id}`);
            })
            .catch((error: DiscordAPIError) =>
                discordErrorJson(
                    res,
                    error,
                    RESTJSONErrorCodes.UnknownApplication,
                    res.__("common.error.bot.arr.notFound"),
                    res.__("common.error.bot.arr.fetchError")
                )
            );
    }
}

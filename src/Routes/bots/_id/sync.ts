import { PathRoute } from "../../route.ts";
import {
    type APIApplication,
    type APIApplicationCommand,
    type APIUser, type DiscordAPIError, RESTJSONErrorCodes,
    type RESTPostOAuth2AccessTokenResult,
    Routes
} from "discord.js";
import refresh from "passport-oauth2-refresh";
import * as functions from "../../../Util/Function/main.ts";
import * as userCache from "../../../Util/Services/userCaching.ts";
import fetch from "node-fetch";
import { DAPI } from "../../../Util/Services/discord.ts";
import * as discord from "../../../Util/Services/discord.ts";
import * as botCache from "../../../Util/Services/botCaching.ts";
import * as e from "express";
import { variables } from "../../../Util/Function/variables.ts";
import { auth } from "../../../Util/Function/permissions.ts";
import { botExists } from "../../../Util/Function/checks.ts";

export class SyncBot extends PathRoute<"get"> {

    constructor() {
        super("get", "/:id/sync", [variables, auth, botExists]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction): Promise<void> {
        const bot = req.attached.bot;
        let commands: APIApplicationCommand[] = bot.commands || [];
        if (bot.scopes?.slashCommands && req.user.db.auth) {
            if (Date.now() > req.user.db.auth.expires) {
                await refresh.requestNewAccessToken(
                    "discord",
                    req.user.db.auth.refreshToken,
                    async (
                        err,
                        accessToken,
                        refreshToken,
                        result: RESTPostOAuth2AccessTokenResult
                    ) => {
                        if (err) {
                            let errors: string[] = [];

                            if (functions.isDiscordAPIError(err)) {
                                errors.push(`${err.statusCode} ${err.data}`);
                            } else {
                                errors.push(err.message);
                            }

                            return res.status(500).json({
                                error: true,
                                status: 500,
                                errors: [errors]
                            });
                        } else {
                            await global.db.collection("users").updateOne(
                                { _id: req.user.id },
                                {
                                    $set: {
                                        auth: {
                                            accessToken,
                                            refreshToken,
                                            expires:
                                                Date.now() +
                                                result.expires_in * 1000
                                        }
                                    }
                                }
                            );
                            await userCache.updateUser(req.user.id);
                        }
                    }
                );
            }

            const receivedCommands = (await (
                await fetch(DAPI + Routes.applicationCommands(bot._id), {
                    headers: {
                        authorization: `Bearer ${req.user.db.auth.accessToken}`
                    }
                })
            )
                .json()
                .catch(() => {})) as APIApplicationCommand[];
            if (Array.isArray(receivedCommands)) commands = receivedCommands;
        }

        let userFlags = 0;

        if (bot.scopes?.bot) {
            const user = (await discord.bot.rest
                .get(Routes.user(bot._id))
                .catch(() => {})) as APIUser;
            if (user.public_flags) userFlags = user.public_flags;
        }

        discord.bot.rest
            .get(`/applications/${bot.clientID || req.params.id}/rpc`)
            .then(async (app: APIApplication) => {
                if (app.bot_public === false)
                    // not !app.bot_public; should not trigger when undefined
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notPublic")]
                    });

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
                            icon: {
                                hash: bot.icon.hash,
                                url: bot.icon.url
                            },
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
            .catch((error: DiscordAPIError) => {
                if (error.code === RESTJSONErrorCodes.UnknownApplication)
                    return res.status(400).json({
                        error: true,
                        status: 400,
                        errors: [res.__("common.error.bot.arr.notFound")]
                    });

                return res.status(400).json({
                    error: true,
                    status: 400,
                    errors: [
                        res.__("common.error.bot.arr.fetchError"),
                        `${error.name}: ${error.message}`,
                        `${error.code} ${error.method} ${error.url}`
                    ]
                });
            });
    }

}

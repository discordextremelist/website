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

import "./instrument.ts";
import * as Sentry from "@sentry/node";

import express from "express";
import type { Request, Response } from "express";

import path from "path";
import session from "express-session";
import RedisStore from "connect-redis";
import createError from "http-errors";
import passport from "passport";
import logger from "morgan";
import helmet from "helmet";

import * as libCache from "./Util/Services/libCaching.ts";
import * as announcementCache from "./Util/Services/announcementCaching.ts";
import * as legalCache from "./Util/Services/legalCaching.ts";
import * as featuredCache from "./Util/Services/featuring.ts";
import * as banned from "./Util/Services/banned.ts";
import * as discord from "./Util/Services/discord.ts";
import * as tokenManager from "./Util/Services/adminTokenManager.ts";

import languageHandler from "./Util/Middleware/languageHandler.ts";

import { botStatsUpdate } from "./Util/Services/botStatsUpdate.ts";
import { variables } from "./Util/Function/variables.ts";
import { monacoRedirect } from "./Util/Middleware/monacoRedirect.ts";
import { sitemapIndex, sitemapGenerator } from "./Util/Middleware/sitemap.ts";

import i18n from "i18n";
import { MongoClient } from "mongodb";
import Redis from "ioredis";
import { hostname } from "os";

import settings from "../settings.json" with { type: "json" };

import authRoute from "./Routes/authentication.ts";
import autosyncRoute from "./Routes/autosync.ts";
import indexRoute from "./Routes/index.ts";
import searchRoute from "./Routes/search.ts";
import docsRoute from "./Routes/docs.ts";
import botsRoute from "./Routes/bots.ts";
import serversRoute from "./Routes/servers.ts";
import usersRoute from "./Routes/users.ts";
import templatesRoute from "./Routes/templates.ts";
import staffRoute from "./Routes/staff.ts";
import setup from "./setup.ts";

const app = express();
const __dirname = path.resolve();

app.use(helmet());

const corsMiddleware = (_req: Request, res: Response, next: () => void) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
};

app.use("/fonts/fa/webfonts/*", corsMiddleware);
app.use("/upup.min.js", corsMiddleware);

app.set("views", __dirname + "/views");
app.use(express.static(__dirname + "/assets/Public"));

new Promise<void>((resolve, reject) => {
    console.time("Mongo TTL");
    MongoClient.connect(settings.secrets.mongo.uri, {}, (error, mongo) => {
        if (error) return reject(error);
        global.db = mongo.db(settings.secrets.mongo.db);
        console.log(
            "Mongo: Connection established! Released deadlock as a part of startup..."
        );
        console.timeEnd("Mongo TTL");
        resolve();
    });
})
    .then(async () => {
        await setup();

        let redisConfig: Redis.RedisOptions;

        if (settings.secrets.redis.sentinels.length > 0) {
            redisConfig = {
                sentinels: settings.secrets.redis.sentinels,
                name: settings.secrets.redis.name,
                db: settings.secrets.redis.db,
                password: settings.secrets.redis.passwd,
                sentinelPassword: settings.secrets.redis.passwd
            };
        } else {
            redisConfig = {
                port: settings.secrets.redis.port,
                host: settings.secrets.redis.host,
                db: settings.secrets.redis.db,
                password: settings.secrets.redis.passwd
            };
        }

        global.redis = new Redis(redisConfig);
        const s = new Redis(redisConfig);

        /*There is no point in flushing the DEL redis database, it's persistent as is, and will lead to problems. - Ice*/
        console.log("Cache: Attempting to acquire caching lock...");
        const lock = await global.redis.get("cache_lock");
        if (lock && lock != hostname()) {
            // We have a lock, but it is not held for us.
            console.log(
                `Cache: Lock is currently held by ${lock}. Waiting for caching to finish before proceeding...`
            );
            const remain = await global.redis.ttl("cache_lock");
            let got: boolean, r: (value: void | PromiseLike<void>) => void;
            if (remain > 0) {
                console.log(
                    `Cache: Going to wait another ${remain} seconds before the lock is released, assuming cache is done if no event is emitted.`
                );
                setTimeout(() => {
                    if (!got) {
                        r();
                        console.log(
                            "Cache: Cache TTL expired, assuming caching is over."
                        );
                    }
                }, remain * 1000);
            }
            await new Promise<void>((res, _) => {
                r = res;
                s.subscribe("cache_lock", (err) => {
                    if (err) {
                        console.error(
                            `Cache: Subscription failed: ${err}, exiting...`
                        );
                        process.exit();
                    }
                });
                s.on("message", (chan, m) => {
                    if (chan === "cache_lock" && m === "ready") {
                        got = true;
                        res();
                        console.log(
                            "Cache: Caching has completed, app will continue starting."
                        );
                    }
                });
            });
        } else {
            console.log(
                "Cache: No one has the cache lock currently, acquiring it."
            );
            // 300 seconds is a good rule of thumb, it is expected that DEL has another instance running.
            await global.redis.setex("fetch_lock", 300, hostname());
            console.log("Discord: Also acquired the discord lock!");
            await global.redis.setex("cache_lock", 300, hostname());
            console.time("Redis");
            await libCache.cacheLibs();
            await announcementCache.updateCache();
            await featuredCache.updateFeaturedServers();
            await featuredCache.updateFeaturedTemplates();
            await tokenManager.tokenResetAll();
            await legalCache.updateCache();
            console.timeEnd("Redis");
            console.time("Discord: Bot stats update");
            await botStatsUpdate();
            console.timeEnd("Discord: Bot stats update");
            await global.redis.publish("cache_lock", "ready");
            await global.redis.del("cache_lock");
            console.log("Cache: Dropped cache lock!");
        }

        await discord.bot.login(settings.secrets.discord.token);
        // to replace the needed to wait time for the below functions, instead of using a redundant blocking promise
        // just... do it once it is actually ready -AJ
        discord.bot.once("ready", async () => {
            setTimeout(async () => {
                await featuredCache.updateFeaturedBots();
                await featuredCache.updateFeaturedSFWBots();
                await discord.postMetric();
            }, 10000);

            await discord.postWebMetric("bot");
            await discord.postWebMetric("bot_unapproved");
            await discord.postWebMetric("server");
            await discord.postWebMetric("template");
            await discord.postWebMetric("user");

            await (async function discordBotUndefined() {
                if (
                    typeof discord.bot.guilds !== "undefined" &&
                    typeof discord.guilds.main !== "undefined" &&
                    typeof discord.guilds.bot !== "undefined"
                ) {
                    await banned.updateBanlist();
                    await discord.uploadStatuses();
                } else {
                    setTimeout(discordBotUndefined, 250);
                }
            })();
        });
        app.set("view engine", "ejs");

        app.use(
            logger(
                // @ts-expect-error
                ':req[cf-connecting-ip] - [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer"',
                {
                    skip: (r: { url: string }) =>
                        r.url === "/profile/game/snakes"
                }
            )
        );
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));

        i18n.configure({
            locales: settings.website.locales.all,
            directory: __dirname + "/node_modules/del-i18n/website",
            defaultLocale: settings.website.locales.default
        });

        global.env_prod = !settings.website.dev;

        if (global.env_prod) {
            app.set("trust proxy", 1); // trust first proxy
        }

        app.use(
            session({
                store: new RedisStore({ client: global.redis }),
                secret: settings.secrets.cookie,
                resave: false,
                saveUninitialized: false,
                cookie: {
                    secure: global.env_prod,
                    httpOnly: true,
                    maxAge: 14 * 24 * 60 * 60 * 1000
                }
            })
        );

        app.use(passport.initialize());
        app.use(passport.session());

        app.use((req, res, next) => {
            res.locals.user = req.user;

            if (req.user && !settings.website.dev) {
                Sentry.setUser({
                    id: req.user.id,
                    username: req.user.username
                });
            }

            next();
        });

        app.get("/sitemap.xml", sitemapIndex);

        app.use(i18n.init);

        app.get(
            "/:lang/auth/login",
            languageHandler,
            variables,
            (req: Request, res: Response) => {
                if (req.user) res.redirect("/");

                res.locals.premidPageInfo = res.__("premid.login");
                res.locals.hideLogin = true;

                res.render("templates/login", {
                    title: res.__("common.login.short"),
                    subtitle: res.__("common.login.subtitle"),
                    req
                });
            }
        );

        app.use("/auth", authRoute);
        app.use("/autosync", autosyncRoute);

        // Locale handler.
        // Don't put anything below here that you don't want its locale to be checked whatever (broken english kthx)
        app.use(["/:lang", "/"], languageHandler);

        app.use("/:lang/sitemap.xml", sitemapGenerator);

        app.use("/:lang", indexRoute);
        app.use("/:lang/search", searchRoute);
        app.use("/:lang/docs", docsRoute);

        app.use("*", monacoRedirect);

        app.use("/:lang/bots", botsRoute);
        app.use("/:lang/servers", serversRoute);
        app.use("/:lang/templates", templatesRoute);
        app.use("/:lang/users", usersRoute);
        app.use("/:lang/staff", staffRoute);

        app.use(variables);

        if (!settings.website.dev) Sentry.setupExpressErrorHandler(app);

        app.use((_req: Request, _res: Response, next: () => void) => {
            // @ts-expect-error
            next(createError(404));
        });

        app.use(
            (
                err: { message: string; status?: number },
                req: Request,
                res: Response
            ) => {
                res.locals.message = err.message;
                res.locals.error = err;

                if (!settings.website.dev && err.message !== "Not Found") {
                    Sentry.captureException(err); // Capture the error in Sentry
                }

                if (err.message === "Not Found") {
                    return res.status(404).render("status", {
                        res,
                        title: res.__("common.error"),
                        subtitle: res.__("common.error.404"),
                        req,
                        status: 404,
                        type: "Error"
                    });
                }

                console.log("ERROR! ", err);

                res.status(err.status || 500);
                res.render("error", { error: err });
            }
        );

        app.listen(settings.website.port.value || 3000, () => {
            console.log(
                `Website: Ready on port ${settings.website.port.value || 3000}`
            );
        });
    })
    .catch((e) => {
        console.error("Mongo error: ", e);
        process.exit(1);
    });
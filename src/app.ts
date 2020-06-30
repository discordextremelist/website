/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020 Cairo Mitchell-Acason, John Burke, Advaith Jagathesan

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

import express from "express";
import { Request, Response } from "express";

import * as path from "path";
import * as device from "express-device";
import cookieSession from "cookie-session";
import cookieParser from "cookie-parser";
import createError from "http-errors";
import passport from "passport";
import logger from "morgan";

import * as botCache from "./Util/Services/botCaching";
import * as serverCache from "./Util/Services/serverCaching";
import * as templateCache from "./Util/Services/templateCaching";
import * as userCache from "./Util/Services/userCaching";
import * as libCache from "./Util/Services/libCaching";
import * as announcementCache from "./Util/Services/announcementCaching";
import * as featuredCache from "./Util/Services/featuring";
import * as ddosMode from "./Util/Services/ddosMode";
import * as banned from "./Util/Services/banned";
import * as discord from "./Util/Services/discord";
import * as tokenManager from "./Util/Services/adminTokenManager";

import * as languageHandler from "./Util/Middleware/languageHandler";

import { botStatsUpdate } from "./Util/Services/botStatsUpdate";
import { variables } from "./Util/Function/variables";
import { monacoIsStupid } from "./Util/Middleware/monacoIsStupid";
import { sitemapIndex, sitemapGenerator } from "./Util/Middleware/sitemap";

const i18n = require("i18n");
import * as settings from "../settings.json";
import { MongoClient } from "mongodb";

const app = express();

let dbReady: boolean = false;

app.set("views", path.join(__dirname + "/../../assets/Views"));
app.use(express.static(path.join(__dirname + "/../../assets/Public")));

app.get("*", (req: Request, res: Response, next: () => void) => {
    if (
        dbReady === false &&
        !req.url.includes(".css") &&
        !req.url.includes(".woff2")
    ) {
        return res
            .status(503)
            .sendFile(
                path.join(__dirname + "/../../assets/Public/loading.html")
            );
    } else next();
});

new Promise((resolve, reject) => {
    console.time("Mongo TTL");
    MongoClient.connect(
        settings.secrets.mongo.uri,
        { useUnifiedTopology: true, useNewUrlParser: true }, // useNewUrlParser is set to true because sometimes MongoDB is a cunt - Ice, I love this comment - Cairo
        (error, mongo) => {
            if (error) return reject(error);
            global.db = mongo.db(settings.secrets.mongo.db);
            console.log(
                "Mongo: Connection established! Released deadlock as a part of startup..."
            );
            console.timeEnd("Mongo TTL");
            resolve();
        }
    );
})
    .then(async () => {
        dbReady = true;

        for (const lib of require("../../assets/libraries.json")) {
            await global.db
                .collection("libraries")
                .updateOne(
                    { _id: lib.name },
                    {
                        _id: lib.name,
                        language: lib.language,
                        links: {
                            docs: lib.links.docs,
                            repo: lib.links.repo
                        }
                    },
                    { upsert: true }
                )
                .then(() => true)
                .catch(() => false);
        }
        if (
            !(await global.db
                .collection("webOptions")
                .findOne({ _id: "ddosMode" })) ||
            !(await global.db
                .collection("webOptions")
                .findOne({ _id: "announcement" }))
        ) {
            await global.db
                .collection("webOptions")
                .insertOne({
                    _id: "ddosMode",
                    active: false
                })
                .then(() => true)
                .catch(() => false);
            await global.db
                .collection("webOptions")
                .insertOne({
                    _id: "announcement",
                    active: false,
                    message: "",
                    colour: "",
                    foreground: ""
                })
                .then(() => true)
                .catch(() => false);
        }

        global.redis = new (require("ioredis"))({
            port: settings.secrets.redis.port,
            host: settings.secrets.redis.host,
            db: settings.secrets.redis.db,
            password: settings.secrets.redis.passwd
        });

        global.redis.flushdb();

        console.time("Redis Cache & Core Refresh");
        await userCache.uploadUsers();
        await botCache.uploadBots();
        await serverCache.uploadServers();
        await templateCache.uploadTemplates();
        await libCache.cacheLibs();
        await announcementCache.updateCache();
        await featuredCache.updateFeaturedBots();
        await featuredCache.updateFeaturedServers();
        await featuredCache.updateFeaturedTemplates();
        await ddosMode.updateCache();
        await botStatsUpdate();
        await tokenManager.tokenResetAll();

        setTimeout(async () => {
            await discord.postMetric();
        }, 10000);

        await (async function discordBotUndefined() {
            if (
                typeof discord.bot.guilds !== "undefined" &&
                typeof discord.bot.guilds.cache.get(settings.guild.main) !==
                    "undefined"
            ) {
                await banned.updateBanlist();
                await discord.uploadStatuses();
            } else {
                setTimeout(discordBotUndefined, 250);
            }
        })();

        console.timeEnd("Redis Cache & Core Refresh");

        app.set("view engine", "ejs");

        app.use(
            logger(
                // @ts-ignore
                ':req[cf-connecting-ip] - [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer"',
                {
                    skip: (r: { url: string }) =>
                        r.url === "/profile/game/snakes"
                }
            )
        );
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));

        app.use(device.capture());

        i18n.configure({
            locales: settings.website.locales.all,
            directory: __dirname + "/../../node_modules/del-i18n/website",
            defaultLocale: settings.website.locales.default
        });

        app.use(
            cookieSession({
                name: "delSession",
                secret: settings.secrets.cookie,
                maxAge: 1000 * 60 * 60 * 24 * 7
            })
        );

        app.use(cookieParser(settings.secrets.cookie));

        app.use(passport.initialize());
        app.use(passport.session());

        app.use((req, res, next) => {
            res.locals.user = req.user;
            next();
        });

        app.get("/sitemap.xml", sitemapIndex);

        app.use(i18n.init);

        app.use("/auth", require("./Routes/authentication"));
         
        // Locale handler.
        // Don't put anything below here that you don't want it's locale to be checked whatever (broken english kthx)
        app.use(["/:lang", "/"], languageHandler.homeHandler);
        app.use("/:lang/*", languageHandler.globalHandler);

        app.use("/:lang/sitemap.xml", sitemapGenerator);

        app.use("/:lang", require("./Routes/index"));
        app.use("/:lang/search", require("./Routes/search"));
        app.use("/:lang/docs", require("./Routes/docs"));

        app.use("*", monacoIsStupid);

        app.use("/:lang/bots", require("./Routes/bots"));
        app.use("/:lang/servers", require("./Routes/servers"));
        app.use("/:lang/templates", require("./Routes/templates"));
        app.use("/:lang/users", require("./Routes/users"));
        app.use("/:lang/staff", require("./Routes/staff"));

        app.use(variables);

        app.use((req: Request, res: Response, next: () => void) => {
            // @ts-ignore
            next(createError(404));
        });
        
        app.use(
            (
                err: { message: string; status?: number },
                req: Request,
                res: Response,
                next: () => void
            ) => {
                res.locals.message = err.message;
                res.locals.error = err;

                if (err.message === "Not Found")
                    return res.status(404).render("status", {
                        title: res.__("common.error"),
                        subtitle: res.__("common.error.404"),
                        status: 404,
                        type: res.__("common.error"),
                        req: req,
                        pageType: {
                            home: false,
                            standard: true,
                            server: false,
                            bot: false,
                            template: false
                        }
                    });

                res.status(err.status || 500);
                res.render("error");
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

export = app;

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

const express = require("express")

const path = require("path");

require("dotenv").config()
const settings = require("./settings.json");

const app = express();

dbReady = false;

app.set("views", path.join(__dirname, "src/Assets/Views"));
app.use(express.static(path.join(__dirname, "src/Assets/Public")));

app.get("*", (req, res, next) => {
    if (
        dbReady === false &&
        !req.url.includes(".css") &&
        !req.url.includes(".woff2")
    ) {
        return res
            .status(503)
            .sendFile(path.join(__dirname + "/src/Assets/Public/loading.html"));
    } else next();
});

console.time("Mongo TTL");
console.log("Mongo: Connection opening...");
const { MongoClient } = require("mongodb");
let db;
new Promise((resolve, reject) => {
    MongoClient.connect(
        process.env.MONGO_URI,
        { useUnifiedTopology: true, useNewUrlParser: true }, // useNewUrlParser is set to true because sometimes MongoDB is a cunt - Ice, I love this comment - Cairo
        (error, mongo) => {
            if (error) return reject(error);
            db = mongo.db(process.env.MONGO_DB);
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
        app.db = db;

        for (const lib of require(__dirname+"/src/Assets/libraries.json")) {
            await db.collection("libraries").updateOne({ _id: lib.name }, {
                _id: lib.name,
                language: lib.language,
                links: {
                    docs: lib.links.docs,
                    repo: lib.links.repo
                }
            }, { upsert: true }).then(() => true).catch(() => false);
        }
        if (
            !(await db.collection("webOptions").findOne({ _id: "ddosMode" })) ||
            !(await db.collection("webOptions").findOne({ _id: "announcement" }))
        ) {
            await db.collection("webOptions").insertOne({
                _id: "ddosMode",
                active: false
            }).then(() => true).catch(() => false);
            await db.collection("webOptions").insertOne({
                _id: "announcement",
                active: false,
                message: "",
                colour: "",
                foreground: ""
            }).then(() => true).catch(() => false);
        }

        const botCache = require("./src/Util/Services/botCaching.js");
        const serverCache = require("./src/Util/Services/serverCaching.js");
        const templateCache = require("./src/Util/Services/templateCaching.js");
        const userCache = require("./src/Util/Services/userCaching.js");
        const libCache = require("./src/Util/Services/libCaching.js");
        const announcementCache = require("./src/Util/Services/announcementCaching.js");
        const featuredCache = require("./src/Util/Services/featuring.js");
        const ddosMode = require("./src/Util/Services/ddosMode.js");
        const banned = require("./src/Util/Services/banned.js");
        const discord = require("./src/Util/Services/discord.js");
        const botStatsUpdate = require("./src/Util/Services/botStatsUpdate.js");

        global.redis = new (require("ioredis"))({
            port: process.env.REDIS_PORT,
            host: process.env.REDIS_HOST,
            db: process.env.REDIS_DB,
            password: process.env.REDIS_PASSWD
        });

        global.redis.flushdb();

        console.time("Redis Cache");
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
        await (async function discordBotUndefined() {
            if (
                typeof discord.bot.guilds !== "undefined" &&
                typeof discord.bot.guilds.get(settings.guild.main) !==
                    "undefined"
            ) { 
                await banned.updateBanlist();
                await discord.uploadStatuses();
            } else {
                setTimeout(discordBotUndefined, 250);
            }
        })();
        console.timeEnd("Redis Cache");
        await botStatsUpdate();
        setTimeout(async() => {
            await discord.postMetric();
        }, 10000)

        const cookieParser = require("cookie-parser");
        const cookieSession = require("cookie-session");
        const logger = require("morgan");
        const device = require("express-device");
        const i18n = require("i18n");
        const passport = require("passport");
        const languageHandler = require("./src/Util/Middleware/languageHandler.js");
        const sitemap = require("express-sitemap")();

        app.set("view engine", "ejs");

        app.use(
            logger(
                ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer"',
                {
                    skip: (r) => r.url === "/profile/game/snakes"
                }
            )
        );
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));

        app.use(device.capture());

        i18n.configure({
            locales: settings.website.locales.all,
            directory: __dirname + "/node_modules/del-i18n",
            defaultLocale: settings.website.locales.default
        });

        app.use(cookieSession({
            name: "delSession",
            secret: process.env.COOKIE_SECRET,
            maxAge: 1000 * 60 * 60 * 24 * 7
        }));
          
        app.use(cookieParser(process.env.COOKIE_SECRET));

        app.use(passport.initialize());
        app.use(passport.session());

        app.use((req, res, next) => {
            res.locals.user = req.user;
            next();
        });

        app.use(i18n.init);

        app.use("/auth", require("./src/Routes/authentication.js"));

        app.use(["/:lang", "/"], languageHandler.homeHandler);
        app.use("/:lang/*", languageHandler.globalHandler);

        app.use("/:lang", require("./src/Routes/index.js"));
        app.use("/:lang/search", require("./src/Routes/search.js"));
        app.use("/:lang/bots", require("./src/Routes/bots.js"));
        app.use("/:lang/servers", require("./src/Routes/servers.js"));
        app.use("/:lang/templates", require("./src/Routes/templates.js"));
        app.use("/:lang/users", require("./src/Routes/users.js"));
        app.use("/:lang/staff", require("./src/Routes/staff.js"));
        app.use("/:lang/docs", require("./src/Routes/docs.js"));
        /* app.use("/:lang/amp", require("./src/Routes/amp.js"));
           todo - advaith */

        app.use("*", require("./src/Util/Function/variables.js"));

        app.use((err, req, res, next) => {
            console.log(err);
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
        });
    })
    .catch((e) => {
        console.error("Mongo error: ", e);
        process.exit(1);
    });

if (process.env.DEL_ENV === "CI") setTimeout(() => {
    process.exit(0);
}, 120000);

module.exports = app;

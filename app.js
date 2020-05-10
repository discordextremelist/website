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

const express = require("express");
const session = require("express-session");
const path = require("path");

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
        settings.db.mongo.uri,
        { useUnifiedTopology: true, useNewUrlParser: true }, // useNewUrlParser is set to true because sometimes MongoDB is a cunt - Ice, I love this comment - Cairo
        (error, mongo) => {
            if (error) return reject(error);
            db = mongo.db(settings.db.mongo.db);
            console.log("Mongo: Connection established! Released deadlock as a part of startup...");
            console.timeEnd("Mongo TTL");
            resolve();
        }
    );
})
    .then(async () => {
        dbReady = true;
        app.db = db;
        const botCache = require("./src/Util/Services/botCaching.js");
        const serverCache = require("./src/Util/Services/serverCaching.js");
        const templateCache = require("./src/Util/Services/templateCaching.js");
        const userCache = require("./src/Util/Services/userCaching.js");
        const libCache = require("./src/Util/Services/libCaching.js");
        const featuredCache = require("./src/Util/Services/featuring.js");
        const ddosMode = require("./src/Util/Services/ddosMode.js");
        const banned = require("./src/Util/Services/banned.js");
        const discord = require("./src/Util/Services/discord.js");
        global.redis = new (require("ioredis"))(settings.db.redis);

        console.time("Redis Cache");
        await userCache.uploadUsers();
        await botCache.uploadBots();
        await serverCache.uploadServers();
        await templateCache.uploadTemplates();
        await libCache.cacheLibs();
        await featuredCache.updateFeaturedBots();
        await featuredCache.updateFeaturedServers();
        await ddosMode.updateCache();

        async function discordBotUndefined(){
            if (typeof discord.bot.guilds !== "undefined" && typeof discord.bot.guilds.get(settings.guild.main) !== "undefined"){
                await banned.updateBanlist();
                await discord.uploadStatuses();
            } else {
                setTimeout(discordBotUndefined, 250);
            }
        }

        await discordBotUndefined();

        console.timeEnd("Redis Cache");

        const createError = require("http-errors");
        const cookieParser = require("cookie-parser");
        const logger = require("morgan");
        const device = require("express-device");
        const compression = require("compression");
        const i18n = require("i18n");
        const passport = require("passport");
        const RedisStore = require("connect-redis")(session);

        app.set("view engine", "ejs");

        app.use(
            logger(
                ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer"',
                {
                    skip: (r) => r.url === "/profile/game/snakes",
                }
            )
        );
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));
        app.use(cookieParser());
        app.use(compression());

        app.use(device.capture());

        i18n.configure({
            locales: ["en-NZ"],
            directory: __dirname + "/src/Assets/Locale",
            defaultLocale: "en-NZ",
            cookie: "lang",
        });

        app.use(session({
            saveUninitialized: true,
            resave: false,
            secret: settings.website.secrets.cookie,
            cookie: {
                maxAge: 1 * 60 * 60 * 24 * 7
            },
            key: settings.website.secrets.cookie,
            store: new RedisStore({
                client: global.redis,
                ttl: 1 * 60 * 60 * 24 * 7
            })
        }));

        app.use(passport.initialize());
        app.use(passport.session());

        app.use((req, res, next) => {
            res.locals.user = req.user;
            next();
        });

        app.use(i18n.init);

        app.use("/", require("./src/Routes/index.js"));
        app.use("/search", require("./src/Routes/search.js"));
        app.use("/auth", require("./src/Routes/authentication.js"));
        app.use("/bots", require("./src/Routes/bots.js"));
        app.use("/servers", require("./src/Routes/servers.js"));
        app.use("/templates", require("./src/Routes/templates.js"));
        app.use("/users", require("./src/Routes/users.js"));
        app.use("/staff", require("./src/Routes/staff.js"));
        /* app.use("/amp", require("./src/Routes/amp.js"));
           todo - advaith */

        app.use("*", require("./src/Util/Function/variables.js"));

        app.use((req, res, next) => {
            next(createError(404));
        });

        app.use((err, req, res, next) => {
            res.locals.message = err.message;
            res.locals.error = req.app.get("env") === "development" ? err : {};

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
                    },
                });

            res.status(err.status || 500);
            res.render("error");
        });
    })
    .catch((e) => {
        console.error("Mongo error: ", e);
        process.exit(1);
    });

module.exports = app;

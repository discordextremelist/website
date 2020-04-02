const express = require("express");
const session = require("express-session");
const path = require("path");

const redis = require("redis");
const redisClient = redis.createClient();
const redisStore = require("connect-redis")(session);

const settings = require("./settings.json");

const app = express();

dbReady = false;

app.set("views", path.join(__dirname, "src/Assets/Views"));
app.use(express.static(path.join(__dirname, "src/Assets/Public")));

app.get("*", (req, res, next) => {
    if (dbReady === false && !req.url.includes(".css") && !req.url.includes(".woff2")) {
        return res.status(503).sendFile(path.join(__dirname + "/src/Assets/Public/loading.html"));
    } else next();
})

console.log("Mongo: Connection opening...");
const { MongoClient } = require("mongodb");
let db;
new Promise((resolve, reject) => {
    MongoClient.connect(settings.db.mongo, { useUnifiedTopology: true }, (error, mongo) => {
        if (error) return reject(error);
        db = mongo.db("del");
        console.log("Mongo: Connection established! Released deadlock as a part of startup...");
        resolve();
    });
}).then(() => {
    dbReady = true;
    app.db = db;

    redisClient.on("error", (err) => {
        console.error("Redis error: ", err);
    });    

    require("./src/Util/Services/featuring.js");

    const createError = require("http-errors");
    const cookieParser = require("cookie-parser");
    const logger = require("morgan");
    const device = require("express-device");
    const compression = require("compression");
    const passport = require("passport");    
    const i18n = require("i18n");
    
    app.set("view engine", "ejs");

    app.use(logger("dev"));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(compression())
    
    app.use(device.capture());

    i18n.configure({
        locales: ["en-NZ"],
        directory: __dirname + "/src/Assets/Locale",
        defaultLocale: "en-NZ",
        cookie: "lang"
    });

    app.use(session({ store: new redisStore({
            url: settings.db.redis.logins,
            client: redisClient,
            ttl: 86400
        }),
        secret: settings.website.secrets.cookie,
        name: "delSession",
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: false,
            maxAge: 86400000
        }
    }));  
    
    app.use(passport.initialize());
    app.use(passport.session());

    app.use((req, res, next) => {
        res.locals.user = req.user;
        next();
    });

    app.use(i18n.init);

    app.use("/", require("./src/Routes/index.js"));
    app.use("/", require("./src/Routes/authentication.js"));
    app.use("/bots", require("./src/Routes/bots.js"));
    app.use("/users", require("./src/Routes/users.js"));
    app.use("/amp", require("./src/Routes/amp.js"));

    app.use("*", require("./src/Util/Function/variables.js"));

    app.use((req, res, next) => {
        next(createError(404));
    });

    app.use((err, req, res, next) => {
        res.locals.message = err.message;
        res.locals.error = req.app.get("env") === "development" ? err : {};

        if (err.message === "Not Found") return res.status(404).render("status", { 
            title: res.__("Error"), 
            subtitle: "This page does not exist.",
            status: 404, 
            type: "Error",
            req: req,
            pageType: {
                home: false,
                standard: true,
                server: false,
                bot: false
            }
        });

        res.status(err.status || 500);
        res.render("error");
    });

}).catch(e => {
    console.error("Mongo error: ", e);
    process.exit(1);
});

module.exports = app;

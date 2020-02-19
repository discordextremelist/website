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
let client, db;
new Promise((resolve, reject) => {
    // mongodb://localhost:27017
    MongoClient.connect(settings.db.mongo, { useUnifiedTopology: true }, (error, mongo) => {
        if (error) return reject(error);
        client = mongo;
        db = mongo.db("del");
        console.log("Mongo: Connection established! Released deadlock as a part of startup...");
        resolve();
    });
}).then(() => {
    dbReady = true;
    app.db = db;

    redisClient.on("error", (err) => {
        console.log("Redis error: ", err);
    });    

    const createError = require("http-errors");
    const cookieParser = require("cookie-parser");
    const logger = require("morgan");
    const device = require("express-device");
    const compression = require("compression");
    const passport = require("passport");    
    
    app.set("view engine", "ejs");

    app.use(logger("dev"));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(compression())
    
    app.use(device.capture());

    app.use(session({ store: new redisStore({
            url: settings.db.redis,
            client: redisClient,
            ttl: 86400
        }),
        secret: settings.website.secrets.cookie,
        name: "delSession",
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: false,
            maxAge: 604800000
        }
    }));  

    app.use((req, res, next) => {
        res.locals.user = req.user;
        next();
    });
    
    app.use(passport.initialize());
    app.use(passport.session());

    app.use("/", require("./src/Routes/index.js"));
    app.use("/", require("./src/Routes/authentication.js"));
    app.use("/bots", require("./src/Routes/bots.js"));

    app.use((req, res, next) => {
        next(createError(404));
    });

    app.use((err, req, res, next) => {
        res.locals.message = err.message;
        res.locals.error = req.app.get("env") === "development" ? err : {};

        res.status(err.status || 500);
        res.render("error");
    });

}).catch(e => {
    console.error("Mongo error: ", e);
    process.exit(1);
});

module.exports = app;

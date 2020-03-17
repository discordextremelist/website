const express = require("express");
const router = express.Router();

const bodyParser = require("body-parser");
const passport = require("passport");
const Strategy = require("passport-discord").Strategy;

const settings = require("../../settings.json");

passport.use(new Strategy ({
    clientID: settings.client.id,
    clientSecret: settings.client.secret,
    callbackURL: settings.website.url + settings.website.callback,
    scope: settings.website.authScopes,
    authorizationURL: "https://discordapp.com/api/oauth2/authorize?prompt=none"
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => {
        return done(null, profile);
    });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({
    extended: true
}));

router.get("/dev/authinfo", (req, res, next) => {
    res.json(req.user);
});

router.get("/login", passport.authenticate("discord"));

router.get("/login/callback", passport.authenticate("discord", { failureRedirect: "/login" }), async (req, res, next) => {
    const user = await req.app.db.collection("users").findOne({ id: req.user.id });

    if (!user) {
        req.app.db.collection("users").insertOne({
            id: req.user.id,
            name: req.user.username,
            discrim: req.user.discriminator,
            fullUsername: req.user.username + "#" + req.user.discriminator,
            locale: req.user.locale,
            avatar: {
                hash: req.user.avatar,
                url: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}`
            },
            preferences: {
                customGlobalCss: "",
                defaultColour: "#b114ff",
                enableGames: true,
                experiments: false
            },
            profile: {
                bio: "",
                css: "",
                links: {
                    website: "",
                    github: "",
                    gitlab: "",
                    twitter: "",
                    instagram: "",
                    snapchat: ""
                }
            },
            game: {
                snakes: {
                    maxScore: 0
                }
            },
            rank: {
                admin: false,
                assistant: false,
                mod: false,
                verified: false,
                bugHunter: false
            },
            status: {
                pendingStaff: false
            }
        })
    } else {
        req.app.db.collection("users").updateOne({ id: req.user.id }, { $set: {
                name: req.user.username,
                discrim: req.user.discriminator,
                fullUsername: req.user.username + "#" + req.user.discriminator,
                locale: req.user.locale,
                avatar: {
                    hash: req.user.avatar,
                    url: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}`
                }
            }
        });
    }

    res.redirect(req.session.redirectTo || "/");
});

router.get("/logout", async (req, res, next) => {
    await req.logout();
    res.redirect(req.session.redirectTo || "/");
});

module.exports = router;

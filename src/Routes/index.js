const express = require("express");
const chunk = require("chunk");
const router = express.Router();

const variables = require("../Util/Function/variables.js");
const user = require("../Util/Function/user.js");
const featuring = require("../Util/Services/featuring.js");

router.get("/", variables, user, async (req, res, next) => {
    // const bots = await req.app.db.collection("bots").aggregate({ $filter: { status: { approved: true, siteBot: false, archived: false } }, $limit: 3 }).toArray();
    const bots = await featuring.getFeaturedBots();
    const botChunk = chunk(bots, 3);

    // const servers = await req.app.db.collection("servers").aggregate({ $limit: 3 }).toArray();
    const servers = await featuring.getFeaturedServers();
    const serverChunk = chunk(bots, 3);

    res.render("templates/index", { 
        title: "Home", 
        subtitle: "", 
        req, 
        botsData: bots,
        botChunk,
        serversData: servers,
        serverChunk,
    });
});

module.exports = router;

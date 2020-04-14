const express = require("express");
const router = express.Router();

const variables = require("../Util/Function/variables.js");
const permission = require("../Util/Function/permissions"); 

router.get("/", variables, permission.mod, async (req, res) => {
    const bots = await req.app.db.collection("bots").find().toArray();
    const users = await req.app.db.collection("users").find().toArray();
    const servers = await req.app.db.collection("servers").find().toArray();

    res.render("templates/staff/index", { 
        title: res.__("Staff Panel"),
        subtitle: res.__("The centre of moderation and administrative actions on the site"), 
        user: req.user,
        req,
        stats: {
            botCount: bots.length,
            serverCount: servers.length,
            userCount: users.length,
            unapprovedBots: bots.filter(b => !b.status.approved).length
        }
    });
});

router.get("/queue", variables, permission.mod, async (req, res) => {

});

module.exports = router;
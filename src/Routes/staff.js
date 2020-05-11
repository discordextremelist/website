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
const router = express.Router();

const variables = require("../Util/Function/variables.js");
const permission = require("../Util/Function/permissions");

router.get("/", variables, permission.mod, async (req, res) => {
    const bots = await req.app.db.collection("bots").find().toArray();
    const users = await req.app.db.collection("users").find().toArray();
    const servers = await req.app.db.collection("servers").find().toArray();

    res.render("templates/staff/index", { 
        title: res.__("common.nav.me.staffPanel"),
        subtitle: res.__("common.nav.me.staffPanel.subtitle"), 
        user: req.user,
        req,
        stats: {
            botCount: bots.length,
            serverCount: servers.length,
            userCount: users.length,
            unapprovedBots: bots.filter(b => !b.status.approved).length,
            strikes: req.user.db.staffTracking.punishments.strikes.length,
            warnings: req.user.db.staffTracking.punishments.warnings.length,
            standing: req.user.db.staffTracking.details.standing,
            away: req.user.db.staffTracking.details.away.status ? res.__("common.yes") : res.__("common.no")
        }
    });
});

router.get("/queue", variables, permission.mod, async (req, res) => {

});

module.exports = router;
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
const chunk = require("chunk");
const router = express.Router();

const variables = require("../Util/Function/variables.js");
const featuring = require("../Util/Services/featuring.js");

router.get("/", variables, async (req, res, next) => {
    // const bots = await req.app.db.collection("bots").aggregate({ $filter: { status: { approved: true, siteBot: false, archived: false } }, $limit: 3 }).toArray();
    const bots = await featuring.getFeaturedBots();
    const botChunk = chunk(bots, 3);

    // const servers = await req.app.db.collection("servers").aggregate({ $limit: 3 }).toArray();
    const servers = await featuring.getFeaturedServers();
    const serverChunk = chunk(bots, 3);

    res.render("amp/templates/index", {
        title: "Home",
        subtitle: "",
        req,
        botsData: bots,
        botChunk,
        serversData: servers,
        serverChunk
    });
});

module.exports = router;

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
const colour = require("color");
const router = express.Router();

const settings = require("../../settings.json");

const variables = require("../Util/Function/variables.js");
const featuring = require("../Util/Services/featuring.js");
const botCache = require("../Util/Services/botCaching.js");
const serverCache = require("../Util/Services/serverCaching.js");
const discord = require("../Util/Services/discord.js");

router.get("/", variables, async (req, res) => {
    const bots = await featuring.getFeaturedBots();
    const botChunk = chunk(bots, 3);

    const servers = await featuring.getFeaturedServers();
    const serverChunk = chunk(servers, 3);

    res.render("templates/index", { 
        title: res.__("Home"), 
        subtitle: "", 
        req, 
        botsData: bots,
        botChunk,
        serversData: servers,
        serverChunk,
    });
});

router.get("/bots", variables, async (req, res) => {
    await botCache.uploadAllBots();
    const bots = await botCache.getAllBots();
    const botChunk = chunk(bots, 3);

    res.render("templates/bots/index", {
        title: res.__("Bots"),
        subtitle: res.__("Our full list of bots"),
        req,
        botsData: bots,
        botChunk,
        page: (req.query.page) ? parseInt(req.query.page) : 1,
        pages: Math.ceil(bots.length / 9)
    })
});

router.get("/servers", variables, async (req, res) => {
    const servers = await serverCache.getAllServers();
    const serverChunk = chunk(servers, 3);

    res.render("templates/servers/index", {
        title: res.__("Servers"),
        subtitle: res.__("Our full list of servers"),
        req,
        serversData: servers,
        serverChunk,
        page: (req.query.page) ? parseInt(req.query.page) : 1,
        pages: Math.ceil(servers.length / 9)
    })
});

router.get("/terms", variables, (req, res) => {
    res.render("templates/legal/terms", { title: res.__("Terms of Service"), subtitle: res.__("Our website's Terms of Service."), req });
});

router.get("/privacy", variables, (req, res) => {
    res.render("templates/legal/privacy", { title: res.__("Privacy Policy"), subtitle: res.__("Our website's Privacy Policy."), req });
});

router.get("/guidelines", variables, (req, res) => {
    res.render("templates/legal/guidelines", { title: res.__("Website Guidelines"), subtitle: res.__("Our Website Guidelines."), req });
});

router.get("/widgetbot", variables, (req, res) => {
    res.render("templates/widgetbot", { 
        title: res.__("WidgetBot Chat"), 
        subtitle: res.__("Embedded Discord chat for our server by WidgetBot"), 
        colour,
        req, 
        settings 
    });
});

router.get("/about", variables, async (req, res) => {
    const staff = (await req.app.db.collection("users").find().toArray()).filter(({ rank }) => rank.mod);
    const staffChunk = chunk(staff, 3);

    function isBooster(member) {
        // member.db = await req.app.db.collection("users").findOne({ id: member.id }) || null;
        return member.premiumSince != undefined;
    }

    const boosters = await discord.bot.guilds.get(settings.guild.main).members.filter(isBooster);
    const boosterChunk = chunk(boosters, 3);

    console.log(boosters)

    res.render("templates/about", { 
        title: res.__("About"), 
        subtitle: res.__("Information about me and the amazing people who make me possible"), 
        req,
        staffData: staff,
        staffChunk//,
        // boosterData: boosters,
        // boosterChunk
    });
});

module.exports = router;

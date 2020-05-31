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

const settings = require("../../settings.json");

const variables = require("../Util/Function/variables.js");
const featuring = require("../Util/Services/featuring.js");
const botCache = require("../Util/Services/botCaching.js");
const serverCache = require("../Util/Services/serverCaching.js");
const templateCache = require("../Util/Services/templateCaching.js");
const discord = require("../Util/Services/discord.js");

const nickSorter = (a, b) => (a.nick || a.user.username).localeCompare((b.nick || b.user.username));
function sortAll() {
    let members = discord.bot.guilds.get(settings.guild.main).members;
    if (!members) throw new Error("Fetching members failed!");
    const staff = [], donators = [], contributors = [];
    for (const member of members.filter(m=>!m.user.bot)) {
        if (
            member.roles.includes(settings.roles.admin) ||
            member.roles.includes(settings.roles.assistant) ||
            member.roles.includes(settings.roles.mod)
        ) {        
            const admin = member.roles.includes(settings.roles.admin);
            const assistant = member.roles.includes(settings.roles.assistant);
            const mod = member.roles.includes(settings.roles.mod);
            member.order = admin ? 3 : assistant ? 2 : mod ? 1 : 0;
            member.rank = admin ? "admin" : assistant ? "assistant" : mod ? "mod" : null;
            staff.push(member);
        } else if (member.roles.includes(settings.roles.booster) || member.roles.includes(settings.roles.donator)) {
            const booster = member.roles.includes(settings.roles.booster);
            const donator = member.roles.includes(settings.roles.donator);
            member.order = booster ? 1 : donator ? 2 : 0;
            member.rank = booster ? "booster" : "donator";
            donators.push(member);
        } else if (
            member.roles.includes(settings.roles.translators) ||
            member.roles.includes(settings.roles.testers)
        ) {
            const translator = member.roles.includes(settings.roles.translators);
            const tester = member.roles.includes(settings.roles.testers);
            member.order = translator ? 1 : tester ? 2 : 0;
            member.rank = translator ? "translator" : "tester";
            contributors.push(member);
        }
    }
    return {
        staff: staff.sort(nickSorter).sort((a, b) => b.order - a.order),
        donators: donators.sort(nickSorter).sort((a, b) => b.order - a.order),
        contributors: contributors.sort(nickSorter).sort((a, b) => a.order - b.order)
    };
}

router.get("/", variables, async (req, res) => {
    res.locals.premidPageInfo = res.__("premid.home");

    const bots = await featuring.getFeaturedBots();
    const servers = await featuring.getFeaturedServers();
    const templates = await featuring.getFeaturedTemplates();
 
    res.render("templates/index", { 
        title: res.__("common.home"), 
        subtitle: "", 
        req, 
        bots,
        servers,
        templates
    });
});

router.get("/bots", variables, async (req, res) => {
    res.locals.premidPageInfo = res.__("premid.bots");

    const bots = (await botCache.getAllBots()).filter(({status}) => status.approved && !status.siteBot && !status.archived);
    const botChunk = chunk(bots, 9);

    res.render("templates/bots/index", {
        title: res.__("common.bots"),
        subtitle: res.__("common.bots.subtitle"),
        req,
        botsData: bots,
        botChunk,
        page: (req.query.page) ? parseInt(req.query.page) : 1,
        pages: Math.ceil(bots.length / 9)
    })
});

router.get("/servers", variables, async (req, res) => {
    res.locals.premidPageInfo = res.__("premid.servers");

    const servers = await serverCache.getAllServers();
    const serverChunk = chunk(servers, 9);

    res.render("templates/servers/index", {
        title: res.__("common.servers"),
        subtitle: res.__("common.servers.subtitle"),
        req,
        serversData: servers,
        serverChunk,
        page: (req.query.page) ? parseInt(req.query.page) : 1,
        pages: Math.ceil(servers.length / 9)
    })
});

router.get("/templates", variables, async (req, res) => {
    res.locals.premidPageInfo = res.__("premid.templates");

    const templates = await templateCache.getAllTemplates();
    const templateChunk = chunk(templates, 9);

    res.render("templates/serverTemplates/index", {
        title: res.__("common.templates"),
        subtitle: res.__("common.templates.subtitle"),
        req,
        templatesData: templates,
        templateChunk,
        page: (req.query.page) ? parseInt(req.query.page) : 1,
        pages: Math.ceil(templates.length / 9)
    })
});

router.get("/terms", variables, (req, res) => {
    res.locals.premidPageInfo = res.__("premid.terms");

    res.render("templates/legal/terms", { title: res.__("common.nav.more.terms"), subtitle: res.__("common.nav.more.terms.subtitle"), req });
});

router.get("/privacy", variables, (req, res) => {
    res.locals.premidPageInfo = res.__("premid.privacy");

    res.render("templates/legal/privacy", { title: res.__("common.nav.more.privacy"), subtitle: res.__("common.nav.more.privacy.subtitle"), req });
});

router.get("/cookies", variables, (req, res) => {
    res.locals.premidPageInfo = res.__("premid.cookie");

    res.render("templates/legal/cookie", { title: res.__("common.nav.more.cookies"), subtitle: res.__("common.nav.more.cookies.subtitle"), req });
});

router.get("/guidelines", variables, (req, res) => {
    res.locals.premidPageInfo = res.__("premid.guidelines");

    res.render("templates/legal/guidelines", { title: res.__("common.nav.more.guidelines"), subtitle: res.__("common.nav.more.guidelines.subtitle"), req });
});

router.get("/widgetbot", variables, (req, res) => {
    res.locals.premidPageInfo = res.__("premid.widgetbot");

    res.render("templates/widgetbot", { 
        title: res.__("common.discord"), 
        subtitle: res.__("common.discord.subtitle"), 
        req, 
        settings 
    });
});

router.get("/about", variables, async (req, res) => {
    res.locals.premidPageInfo = res.__("premid.about");

    const { staff, donators, contributors } = sortAll();
    res.render("templates/about", { 
        title: res.__("common.nav.more.about"), 
        subtitle: res.__("common.nav.more.about.subtitle"), 
        req,
        staff,
        donators,
        contributors
    });
});

module.exports = router;

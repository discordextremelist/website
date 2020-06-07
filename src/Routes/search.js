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

const router = require("express").Router();
const vars = require("../Util/Function/variables");
const chunk = require("chunk");
const ejs = require("ejs");
const renderPath = require("path").join(process.cwd(), "src/Assets/Views/partials");
const userCache = require("../Util/Services/userCaching");
const botCache = require("../Util/Services/botCaching");
const serverCache = require("../Util/Services/serverCaching");
const templateCache = require("../Util/Services/templateCaching");

router.get("/", vars, (req, res) => {
    res.locals.premidPageInfo = res.__("premid.search");

    return res.render("templates/search", {
        title: res.__("common.search"),
        subtitle: res.__("common.search.subtitle"),
        req
    });
});

router.post("/", vars, async (req, res) => {
    let { query, only } = req.body;
    if (!query) return res.status(400).json({ error: true, status: 400, message: "Missing body parameter 'query'" });
    const originalQuery = query;
    query = query.toLowerCase();
    let isStaff = false;
    if (!!only && only.includes("users")) {
        if (req.user && req.user.id) {
            const user = await req.app.db.collection("users").findOne({ _id: req.user.id });
            if (!user.rank.mod) return res.status(403).json({ error: true, status: 403, message: "Forbidden" });
            isStaff = true;
        } else {
            return res.status(403).json({ error: true, status: 403, message: "Forbidden" });
        }
    }
    const [users, bots, servers, templates] = await Promise.all([
        isStaff ? await userCache.getAllUsers() : [],
        (only.length < 1 || only.includes("bots")) ? await botCache.getAllBots() : [],
        (only.length < 1 || only.includes("servers")) ? await serverCache.getAllServers() : [],
        (only.length < 1 || only.includes("templates")) ? await templateCache.getAllTemplates() : [],
    ]);
    const imageFormat = res.locals.imageFormat;
    let results = chunk(await Promise.all([
        ...users.filter(({ id, name }) => id === query || name.toLowerCase().indexOf(query) >= 0).map(user => {
            return ejs.renderFile(renderPath+"/cards/userCard.ejs", { user, imageFormat, search: true, __: res.locals.__ });
        }),
        ...bots.filter(({ id, name }) => id === query || name.toLowerCase().indexOf(query) >= 0).map(bot => {
            return ejs.renderFile(renderPath+"/cards/botCard.ejs", { bot, imageFormat, queue: false, verificationApp: false, search: true, __: res.locals.__ });
        }),
        ...servers.filter(({ id, name }) => id === query || name.toLowerCase().indexOf(query) >= 0).map(server => {
            return ejs.renderFile(renderPath+"/cards/serverCard.ejs", { server, imageFormat, search: true, __: res.locals.__ });
        }),
        ...templates.filter(({ id, name }) => id === query || name.toLowerCase().indexOf(query) >= 0).map(server => {
            return ejs.renderFile(renderPath+"/cards/templateCard.ejs", { server, imageFormat, search: true, __: res.locals.__ });
        })
    ]), 3);

    return res.json({
        error: false,
        status: 200,
        data: {
            query: originalQuery,
            pages: results
        }
    });
});

module.exports = router;
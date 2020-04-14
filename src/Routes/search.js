const router = require("express").Router();
const vars = require("../Util/Function/variables");
const chunk = require("chunk");
const ejs = require("ejs");
const renderPath = require("path").join(process.cwd(), "src/Assets/Views/partials");

router.get("/", vars, (req, res) => {
    return res.render("templates/search", {
        title: res.__("Search"),
        subtitle: res.__("Search the entire website database"),
        req
    });
});

router.post("/", vars, async (req, res) => {
    let { q, only, page } = req.query;
    if (!q) return res.status(400).json({ error: true, status: 400, message: "Missing query parameter 'term'" });
    const originalQuery = q;
    q = q.toLowerCase();
    only = (only || "").split(/,(?:\s+)?/).filter(s=>!!s).map(o=>o.toLowerCase());
    let isStaff = false;
    if (!!only && only.includes("users")) {
        if (req.user && req.user.id) {
            const user = await req.app.db.collection("users").findOne({ id: req.user.id });
            if (!user.rank.mod) return res.status(403).json({ error: true, status: 403, message: "Forbidden" });
            isStaff = true;
        } else {
            return res.status(403).json({ error: true, status: 403, message: "Forbidden" });
        }
    }
    const [users, bots, servers] = await Promise.all([
        isStaff ? await req.app.db.collection("users").find({}, { projection: { _id: 0, status: 0, preferences: 0, locale: 0, staffTracking: 0 } }).toArray() : [],
        (only.length < 1 || only.includes("bots")) ? await req.app.db.collection("bots").find({}, { projection: { _id: 0, token: 0, modNotes: 0, votes: 0, "status.pendingVerification": 0 } }).toArray() : [],
        (only.length < 1 || only.includes("servers")) ? await req.app.db.collection("servers").find({}, { projection: { _id: 0 } }).toArray() : [],
    ]); // TODO: Redis cache this later for quicker search, or use elasticsearch. Current response time as of now ~2500ms!
    const imageFormat = res.locals.imageFormat;
    let results = chunk(await Promise.all([
        ...users.filter(({ id, name }) => id === q || name.toLowerCase().indexOf(q) >= 0).map(user => {
            return ejs.renderFile(renderPath+"/cards/userCard.ejs", { user, imageFormat, search: true, __: res.locals.__ });
        }),
        ...bots.filter(({ id, name }) => id === q || name.toLowerCase().indexOf(q) >= 0).map(bot => {
            return ejs.renderFile(renderPath+"/cards/botCard.ejs", { bot, imageFormat, queue: false, verificationApp: false, search: true, __: res.locals.__ });
        }),
        ...servers.filter(({ id, name }) => id === q || name.toLowerCase().indexOf(q) >= 0).map(server => {
            return ejs.renderFile(renderPath+"/cards/serverCard.ejs", { server, imageFormat, search: true, __: res.locals.__ });
        })
    ]), 3);
    return res.json({
        error: false,
        status: 200,
        data: {
            q: originalQuery,
            pages: results
        }
    });
});

module.exports = router;
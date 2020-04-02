const auth = (req, res, next) => {
    if (req.user) { 
        next();
    } else {
        res.redirect("/login");
    }
}

const member = (req, res, next) => {
    if (!bot.guilds.get(settings.guilds.mainID).members.get(member.id)) {
        return res.status(403).render("status", {
            title: res.__("Error"),
            status: 403,
            subtitle: res.__("You need to be in our Discord guild to access this endpoint"),
            req,
            type: "Error"
        });
    }
}

const mod = (req, res, next) => {
    if (req.user.db.rank.mod === true) {
        next();
    } else {
        return res.status(403).render("status", {
            title: res.__("Error"),
            status: 403,
            subtitle: res.__("You need to be a Website Moderator to access this endpoint"),
            req,
            type: "Error"
        });
    }
}

const assistant = (req, res, next) => {
    if (req.user.db.rank.assistant === true) {
        next();
    } else {
        return res.status(403).render("status", {
            title: res.__("Error"),
            status: 403,
            subtitle: res.__("You need to be a Website Assistant to access this endpoint"),
            req,
            type: "Error"
        });
    }
}
const admin = (req, res, next) => {
    if (req.user.db.rank.admin === true) {
        next();
    } else {
        return res.status(403).render("status", {
            title: res.__("Error"),
            status: 403,
            subtitle: res.__("You need to be a Website Administrator to access this endpoint"),
            req,
            type: "Error"
        });
    }
}

module.exports = {
    auth,
    member,
    mod,
    assistant,
    admin
};
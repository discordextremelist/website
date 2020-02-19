const auth = (req, res, next) => {
    if (req.user) { 
        next();
    } else {
        res.redirect("/login");
    }
}

const member = (req, res, next) => {
    if (!bot.guilds.get(settings.guilds.mainID).members.get(member.id)) {
        res.status(403).render("status")
    }
}

const mod = (req, res, next) => {
    if (req.user.db.rank.mod === true) {
        next();
    } else {
        // err
    }
}

const assistant = (req, res, next) => {
    if (req.user.db.rank.assistant === true) {
        next();
    } else {
        // err
    }
}
const admin = (req, res, next) => {
    if (req.user.db.rank.admin === true) {
        next();
    } else {
        // err
    }
}

module.exports = {
    auth,
    member,
    mod,
    assistant,
    admin
};
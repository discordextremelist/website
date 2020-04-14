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
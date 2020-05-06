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
const fetch = require("node-fetch");
const md = require("markdown-it")();
const Entities = require("html-entities").XmlEntities;
const entities = new Entities();
const sanitizeHtml = require("sanitize-html");
const router = express.Router();

const settings = require("../../settings.json");
const variables = require("../Util/Function/variables.js");
const permission = require("../Util/Function/permissions.js");
const functions = require("../Util/Function/main.js");
const discord = require("../Util/Services/discord.js");

const userCache = require("../Util/Services/userCaching.js");

router.get("/submit", variables, permission.auth, async (req, res, next) => {
    // do shit here
});

module.exports = router;
const express = require("express");
const router = express.Router();

const variables = require("../Util/Function/variables.js");
const user = require("../Util/Function/user.js");

router.get("/", variables, user, (req, res, next) => {
    res.render("templates/index", { title: "Home", subtitle: "", req });
});

module.exports = router;

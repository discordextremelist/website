const browser = require("browser-detect");

const middleware = (req, res, next) => {
    res.locals.browser = browser(req.headers["user-agent"]);
    next();
};

module.exports = middleware;

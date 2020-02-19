const user = async (req, res, next) => {
    if (req.user) {
        const user = await req.app.db.collection("users").findOne({ id: req.user.id });
        req.user.db = user;
    }

    next();
}

module.exports = user;
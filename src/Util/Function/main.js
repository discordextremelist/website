const bot = require("../Services/discordBot.js");

const statusUpdate = async () => {
    const count = await app.db.collection("bots").find().length;

    if (count > 1) {
        bot.user.setPresence({
            status: "online",
            game: {
                name: `${count} listed bots ($)`,
                type: "WATCHING"
            }
        });
    } else if (count === 1) {
        bot.user.setPresence({
            status: "online",
            game: {
                name: `${count} listed bot ($)`,
                type: "WATCHING"
            }
        });
    } else if (count === 0) {
        bot.user.setPresence({
            status: "online",
            game: {
                name: `No listed bots ($)`,
                type: "WATCHING"
            }
        });
    } else {
        bot.user.setPresence({
            status: "online",
            game: {
                name: `${count} listed bot(s) ($)`,
                type: "WATCHING"
            }
        });
    }
}

const escapeFormatting = (text) => {
    const unescaped = text.replace(/\\(\*|_|`|~|\\)/g, '$1');
    const escaped = unescaped.replace(/(\*|_|`|~|\\)/g, '\\$1');
    return escaped;
}

module.exports = {
    statusUpdate,
    escapeFormatting
}
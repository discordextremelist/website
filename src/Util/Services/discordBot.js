const Discord = require("discord.js");

const settings = require("../../../settings.json");
const functions = require("../Function/main.js");

const bot = new Discord.Client();

bot.on("ready", async () => {
    console.log("Website: Started website/bot hook");
    if (process.env.EXECUTOR === "pm2") {
        process.send("ready");
        console.log("PM2: Ready signal sent");
    }

    await functions.statusUpdate();
});

bot.login(settings.client.token);

module.exports = bot;

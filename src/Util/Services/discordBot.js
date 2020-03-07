const Discord = require("discord.js");

const settings = require("../../../settings.json");
const functions = require("../Function/main.js");

const client = new Discord.Client();

client.on("ready", async () => {
    console.log("Website: Started website/bot hook");
    if (process.env.EXECUTOR === "pm2") {
        process.send("ready");
        console.log("PM2: Ready signal sent");
    }

    await functions.statusUpdate;
});

client.login(settings.client.token);

module.exports = client;

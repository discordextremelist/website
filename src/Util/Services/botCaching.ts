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

const prefix = "bots";

export async function getBot(id: string): Promise<delBot> {
    const bot = await global.redis?.hget(prefix, id);
    if (!bot) return;

    const parsedBot = JSON.parse(bot);
    if (parsedBot.id) parsedBot._id = parsedBot.id;

    return parsedBot;
}

export async function getAllBots(): Promise<delBot[]> {
    const bots = await global.redis?.hvals(prefix);
    // @ts-ignore
    return bots.map(JSON.parse);
}

export async function updateBot(id: string) {
    const data: delBot = await global.db
        .collection("bots")
        .findOne({ _id: id });
    if (!data) return;
    await global.redis?.hmset(prefix, id, JSON.stringify(data));
}

export async function uploadBots() {
    const botsDB: delBot[] = await global.db
        .collection("bots")
        .find()
        .toArray();
    if (botsDB.length < 1) return;

    for (const bot of botsDB) {
        /* 
        Yes I know, don't do this (@ts-ignore)... it's because ID does not exist on delBot type and
        I don't want to add it as this is a fix for a weird bug.
        */

        // @ts-ignore
        if (bot.id) bot._id = bot.id;
    }

    await global.redis?.hmset(
        prefix,
        ...botsDB.map((bot: delBot) => [bot._id, JSON.stringify(bot)])
    );
}

export async function deleteBot(id: string) {
    await global.redis?.hdel(prefix, id);
}

setInterval(async () => {
    await uploadBots();
}, 900000);

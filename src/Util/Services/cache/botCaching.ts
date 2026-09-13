/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020-2025 Carolina Mitchell, John Burke, Advaith Jagathesan

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

import { ListingCache } from "./listingCache.ts";

/**
 * Bots differ from the other caches in two ways: get() returns undefined for
 * a bot that isn't cached, and older documents stored the ID as `id`, which is
 * copied to `_id` when reading from the cache and when uploading to it.
 */
class BotCache extends ListingCache<delBot, undefined> {
    constructor() {
        super("bots");
    }

    override async get(id: string): Promise<delBot | undefined> {
        const bot = await global.redis?.hget(this.name, id);
        if (!bot) return;

        const parsedBot = JSON.parse(bot);
        if (parsedBot.id) parsedBot._id = parsedBot.id;

        return parsedBot;
    }

    protected override async load(): Promise<delBot[]> {
        const botsDB = await super.load();

        for (const bot of botsDB) {
            // Older documents stored the ID as `id`.
            const legacyId = (bot as delBot & { id?: string }).id;
            if (legacyId) bot._id = legacyId;
        }

        return botsDB;
    }
}

const cache = new BotCache();

export const getBot = (id: string) => cache.get(id);
export const getAllBots = () => cache.getAll();
export const updateBot = (id: string) => cache.update(id);
export const uploadBots = () => cache.upload();
export const deleteBot = (id: string) => cache.delete(id);

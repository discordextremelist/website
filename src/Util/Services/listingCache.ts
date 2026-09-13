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

import type { Filter } from "mongodb";

/**
 * A Redis hash mirroring one Mongo collection, keyed by document ID. The bot,
 * server, template and user caches each extend it; `name` is both the hash
 * key and the collection name.
 *
 * `Missing` is what get() returns for an ID that isn't cached: null, except
 * for bots (see BotCache).
 */
export abstract class ListingCache<
    T extends { _id: string },
    Missing extends null | undefined = null
> {
    constructor(protected readonly name: string) {}

    async get(id: string): Promise<T | Missing> {
        const raw = await global.redis?.hget(this.name, id);
        // Subclasses whose Missing isn't null override get().
        return raw === null ? (null as Missing) : JSON.parse(raw);
    }

    async getAll(): Promise<T[]> {
        const all = await global.redis?.hvals(this.name);
        return all.map((s) => JSON.parse(s));
    }

    /** Re-read one document from the database into the cache. */
    async update(id: string) {
        const data = await global.db
            .collection<T>(this.name)
            .findOne({ _id: id } as Filter<T>);
        if (!data) return;
        await global.redis?.hmset(this.name, id, JSON.stringify(data));
    }

    /** Copy every document from the database into the cache. */
    async upload() {
        const docs = await this.load();
        if (docs.length < 1) return;
        await global.redis?.hmset(
            this.name,
            ...docs.map((doc) => [doc._id, JSON.stringify(doc)])
        );
    }

    async delete(id: string) {
        await global.redis?.hdel(this.name, id);
    }

    /** Every document upload() caches. */
    protected async load(): Promise<T[]> {
        return (await global.db
            .collection<T>(this.name)
            .find()
            .toArray()) as T[];
    }
}

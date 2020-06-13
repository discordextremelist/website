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

import * as app from "../../app";
const prefix = "templates";

export async function getTemplate(id: string): Promise<dbTemplate> {
    const template = await global.redis.hget(prefix, id);
    return JSON.parse(template);
}

export async function getAllTemplates(): Promise<dbTemplate[]> {
    const templates = await global.redis.hvals(prefix);
    return templates.map(JSON.parse);
}

export async function updateTemplate(id: string) {
    const data: dbTemplate = await global.db
        .collection("templates")
        .findOne({ _id: id });
    if (!data) return;
    await global.redis.hmset(prefix, id, JSON.stringify(data));
}

export async function uploadTemplates() {
    const templates: dbTemplate[] = await global.db
        .collection("templates")
        .find()
        .toArray();
    if (templates.length < 1) return;
    await global.redis.hmset(
        prefix,
        ...templates.map((t: dbTemplate) => [t._id, JSON.stringify(t)])
    );
}

export async function deleteTemplate(id: string) {
    await global.redis.hdel(prefix, id);
}

setInterval(async () => {
    await uploadTemplates();
}, 900000);

/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020-2024 Carolina Mitchell, John Burke, Advaith Jagathesan

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

export function getLibs() {
    return global.libs?.sort((a, b) => a._id.localeCompare(b._id));
}

export function hasLib(name: string) {
    return global.libs?.find((x) => x._id === name);
}

export async function cacheLibs() {
    const libraries: library[] = [];
    // @ts-ignore
    const dbLibs: library[] = await global.db
        .collection<library>("libraries")
        .find()
        .toArray();
    for (const lib of dbLibs) libraries.push(lib);
    global.libs = libraries;
}

export async function addLib(
    { name, language, links: { docs, repo } }: library = {
        name: "",
        language: "",
        links: { docs: "", repo: "" }
    }
) {
    await global.db.collection("libraries").updateOne(
        { _id: name },
        {
            language,
            links: { docs, repo }
        },
        { upsert: true }
    );
    global.libs[global.libs.findIndex((x) => x._id === name)] = {
        language,
        links: { docs, repo }
    };
}

export async function removeLib(name: string) {
    const index = global.libs.findIndex((x) => x._id === name);
    if (index) {
        global.libs.splice(index, 1);
        await global.db.collection("libraries").deleteOne({ _id: name });
    }
}

setInterval(async () => {
    await cacheLibs();
}, 900000);

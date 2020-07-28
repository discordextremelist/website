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

const prefix = "users";

export async function getUser(id: string): Promise<delUser> {
    const user = await global.redis?.hget(prefix, id);
    return JSON.parse(user);
}

export async function getAllUsers(): Promise<delUser[]> {
    const users = await global.redis?.hvals(prefix);
    // @ts-ignore
    return users.map(JSON.parse);
}

export async function updateUser(id: string) {
    const data: delUser = await global.db
        .collection("users")
        .findOne({ _id: id });
    if (!data) return;
    await global.redis?.hmset(prefix, id, JSON.stringify(data));
}

export async function uploadUsers() {
    const usersDB: delUser[] = await global.db
        .collection("users")
        .find()
        .toArray();
    if (usersDB.length < 1) return;
    await global.redis?.hmset(
        prefix,
        ...usersDB.map((u: delUser) => [u._id, JSON.stringify(u)])
    );
}

export async function deleteUser(id: string) {
    await global.redis?.hdel(prefix, id);
}

setInterval(async () => {
    await uploadUsers();
}, 900000);

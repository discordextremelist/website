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

const prefix = "servers";

export async function getServer(id: string): Promise<delServer> {
    const server = await global.redis.hget(prefix, id);
    return JSON.parse(server);
}

export async function getAllServers(): Promise<delServer[]> {
    const servers = await global.redis.hvals(prefix);
    return servers.map(JSON.parse);
}

export async function updateServer(id: string) {
    const data: delServer = await global.db
        .collection("servers")
        .findOne({ _id: id });
    if (!data) return;
    await global.redis.hmset(prefix, id, JSON.stringify(data));
}

export async function uploadServers() {
    const servers: delServer[] = await global.db
        .collection("servers")
        .find()
        .toArray();
    if (servers.length < 1) return;
    await global.redis.hmset(
        prefix,
        ...servers.map((s: delServer) => [s._id, JSON.stringify(s)])
    );
}

export async function deleteServer(id: string) {
    await global.redis.hdel(prefix, id);
}

setInterval(async () => {
    await uploadServers();
}, 900000);

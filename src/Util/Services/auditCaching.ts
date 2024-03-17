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

const prefix = "audit";

export async function getAuditLog(id: string): Promise<auditLog> {
    const log = await global.redis?.hget(prefix, id);
    return JSON.parse(log);
}

export async function getAllAuditLogs(): Promise<auditLog[]> {
    const logs = await global.redis?.hget(prefix, "all");
    return JSON.parse(logs);
}

export async function uploadAuditLogs() {
    const logs: auditLog[] = (
        (await global.db
            .collection<auditLog>("audit")
            .find()
            .sort({ date: -1 })
            .allowDiskUse()
            .toArray()) as auditLog[]
    ).filter(({ type }) => type !== "GAME_HIGHSCORE_UPDATE");

    if (logs.length < 1) return;
    await global.redis?.hmset(
        prefix,
        ...logs.map((s: auditLog) => [s._id, JSON.stringify(s)])
    );

    await global.redis?.hmset(prefix, "all", JSON.stringify(logs));
}

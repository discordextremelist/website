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

import { guilds } from "./discord.js";

export async function check(user: string): Promise<boolean> {
    const ban = await global.redis?.hget("bans", user);
    return ban !== null;
}

export async function updateBanlist() {
    await global.redis?.del("bans");
    await guilds.main.bans
        .fetch()
        .then(async (bans) => {
            if (bans.size > 0)
                await global.redis?.hmset(
                    "bans",
                    ...bans.map((ban) => [ban.user.id, true])
                );
        })
        .catch((e) => console.error(e));
}

setInterval(async () => {
    await updateBanlist();
}, 900000);

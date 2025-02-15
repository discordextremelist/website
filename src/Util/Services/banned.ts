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
    try {
        if (!global.redis) {
            return false;
        }
        const ban = await global.redis.hget("bans", user);
        return ban !== null && ban !== undefined;
    } catch (error) {
        console.error("Error checking ban status:", error);
        return false;
    }
}

export async function updateBanlist() {
    try {
        if (!global.redis) {
            return;
        }

        const bans = await guilds.main.bans.fetch();
        
        if (bans.size > 0) {
            const multi = global.redis.multi();
            multi.del("bans");
            multi.hmset(
                "bans",
                ...bans.map((ban) => [ban.user.id, "true"])
            );
            await multi.exec();
        } else {
            await global.redis.del("bans");
        }
    } catch (error) {
        console.error("Error updating banlist:", error);
    }
}

const BANLIST_UPDATE_INTERVAL = 900000;
let updateInterval: NodeJS.Timeout;

export function startBanlistUpdates() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(async () => {
        try {
            await updateBanlist();
        } catch (error) {
            console.error("Error in banlist update interval:", error);
        }
    }, BANLIST_UPDATE_INTERVAL);
}

// Initial update and start interval
updateBanlist().catch(console.error);
startBanlistUpdates();

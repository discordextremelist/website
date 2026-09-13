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

import { tokenResetAll } from "../access/adminTokenManager.ts";
import * as announcementCache from "../cache/announcementCaching.ts";
import { updateBanlist } from "../access/banned.ts";
import { botStatsUpdate } from "./botStatsUpdate.ts";
import { postTodaysGrowth, postWebMetric } from "../discord/index.ts";
import {
    updateFeaturedBots,
    updateFeaturedSFWBots,
    updateFeaturedServers,
    updateFeaturedTemplates
} from "../cache/featuring.ts";
import { cacheLibs } from "../cache/libCaching.ts";

/**
 * Start the website's recurring jobs. app.ts calls this once, straight after
 * its imports; each service module used to start its own timer as it was
 * imported.
 */
export function startSchedules() {
    setInterval(async () => {
        await tokenResetAll();
    }, 30000);

    setInterval(async () => {
        await announcementCache.updateCache();
    }, 60000);

    setInterval(async () => {
        await updateBanlist();
    }, 900000);

    setInterval(async () => {
        await botStatsUpdate();
    }, 900000);

    setInterval(async () => {
        await updateFeaturedBots();
        await updateFeaturedSFWBots();
        await updateFeaturedServers();
        await updateFeaturedTemplates();
    }, 900000);

    setInterval(async () => {
        await cacheLibs();
    }, 900000);

    // Let's not query the database of users, and bots, and then make changes to it every 5 seconds, that would be a good thing not to do
    setInterval(async () => {
        await postWebMetric("user");
        await postWebMetric("bot_unapproved");
        await postTodaysGrowth();
    }, 8.568e7); // 23.8h, to account for eventual time drift if the site is online for a while (which is the goal lol) - AJ
}

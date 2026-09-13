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

// The members the About page credits. Reads the gateway member cache
// (website#375 plans to replace that).

import type { GuildMember, GuildMemberManager } from "discord.js";
import settings from "../../../../settings.json" with { type: "json" };
import * as discord from "../../Services/discord/index.ts";

type NamedMember = { nick?: string | null; user: { username: string } };

const nickSorter = (a: NamedMember, b: NamedMember) =>
    (a.nick || a.user.username).localeCompare(b.nick || b.user.username);

/** Copy the user fields the About page shows onto the member. */
function showUser(member: GuildMember) {
    const user = member.user;
    member.avatar = user.avatar;
    member.username = user.username;
    member.discriminator = user.discriminator;
}

/**
 * The staff, donators and contributors the About page credits, from the main
 * DEL server's member cache, each list sorted by rank and then name.
 */
export function aboutPageMembers() {
    let members = discord.guilds.main.members as GuildMemberManager;
    if (!members) throw new Error("Fetching members failed!");
    const staff: GuildMember[] = [],
        donators: GuildMember[] = [],
        contributors: GuildMember[] = [];
    for (const item of members.cache.filter((m) => !m.user.bot)) {
        const member = item[1];
        if (
            member.roles.cache.has(settings.roles.admin) ||
            member.roles.cache.has(settings.roles.assistant) ||
            member.roles.cache.has(settings.roles.mod)
        ) {
            const admin = member.roles.cache.has(settings.roles.admin);
            const assistant = member.roles.cache.has(settings.roles.assistant);
            const mod = member.roles.cache.has(settings.roles.mod);
            member.order = admin ? 3 : assistant ? 2 : mod ? 1 : 0;
            // One of the three is set, per the if above.
            member.rank = admin ? "admin" : assistant ? "assistant" : "mod";

            showUser(member);
            staff.push(member);
        } else if (
            member.roles.cache.has(settings.roles.booster) ||
            member.roles.cache.has(settings.roles.donator)
        ) {
            const booster = member.roles.cache.has(settings.roles.booster);
            const donator = member.roles.cache.has(settings.roles.donator);
            member.order = booster ? 2 : donator ? 1 : 0;
            member.rank = booster ? "booster" : "donator";
            showUser(member);
            donators.push(member);
        } else if (
            member.roles.cache.has(settings.roles.translators) ||
            member.roles.cache.has(settings.roles.testers)
        ) {
            const translator = member.roles.cache.has(
                settings.roles.translators
            );
            const tester = member.roles.cache.has(settings.roles.testers);
            member.order = translator ? 1 : tester ? 2 : 0;
            member.rank = translator ? "translator" : "tester";
            showUser(member);
            contributors.push(member);
        }
    }
    // Every member in these lists had order set above.
    return {
        staff: staff.sort(nickSorter).sort((a, b) => b.order! - a.order!),
        donators: donators.sort(nickSorter).sort((a, b) => b.order! - a.order!),
        contributors: contributors
            .sort(nickSorter)
            .sort((a, b) => a.order! - b.order!)
    };
}

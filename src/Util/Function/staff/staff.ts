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

// Staff standing and rank hierarchy.

import type { Nullable } from "../common/types.js";

/**
 * The standings a staff member can have, in the order the standing form
 * offers them, and the message showing each one's emoji.
 */
export const STANDINGS = {
    Unmeasured: "page.staff.manager.unmeasured.emoji",
    Good: "page.staff.manager.good.emoji",
    Moderate: "page.staff.manager.moderate.emoji",
    "Moderate-Bad": "page.staff.manager.moderateBad.emoji",
    Bad: "page.staff.manager.bad.emoji"
} as const;

/** The message key for a standing's emoji, or "unavailable". */
export function standingParseEmoji(standing: string) {
    // An own-property check, so a standing like "toString" is unavailable.
    return Object.prototype.hasOwnProperty.call(STANDINGS, standing)
        ? STANDINGS[standing as keyof typeof STANDINGS]
        : "page.staff.manager.unavailable";
}

const roleMap: Partial<Record<Role, number>> = {
    admin: 3,
    assistant: 2,
    mod: 1
};

type Role = keyof delUser["rank"];

// I am not sure where we will need strictEq, but we will see.
export function checkRoleHierarchyStaff(
    user: delUser,
    highestPermittedRole: Role,
    strictEq: boolean
): boolean {
    const entries = Object.entries(user.rank) as [Role, boolean][];
    let max: Nullable<number> = null;
    for (const [role, hasRole] of entries) {
        if (!hasRole) continue;
        const val = roleMap[role];
        // Ranks outside roleMap don't count. (The old `val > null` was `val > 0`.)
        if (val !== undefined && (max === null || val > max)) max = val;
    }
    const target = roleMap[highestPermittedRole];
    // Comparing with an undefined target was always false.
    if (max === null || target === undefined) return false;
    return strictEq ? max === target : max >= target;
}

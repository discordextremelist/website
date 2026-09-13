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

/** Who a new user is: everything newUserRecord doesn't default. */
type Identity = Pick<
    delUser,
    "_id" | "auth" | "name" | "discrim" | "fullUsername" | "locale" | "avatar"
>;

/** A user's Discord flags, which a masked-in user doesn't have yet. */
type Flags = delUser["flags"] | undefined;

/** Zeroed counters for one kind of listing a staff member handles. */
function noneHandled(): delUser["staffTracking"]["handledBots"] {
    const zero = () => ({
        total: 0,
        approved: 0,
        unapprove: 0,
        declined: 0,
        remove: 0,
        modHidden: 0
    });
    return { allTime: zero(), prevWeek: zero(), thisWeek: zero() };
}

/**
 * A new user record, with every setting at its default. Used when someone
 * logs in for the first time, and when an admin masks as a user who never
 * has. The record's `flags` has the type the caller passes, so a login's
 * record is a full delUser and a masked-in one, without flags, isn't.
 */
export function newUserRecord<F extends Flags>(
    identity: Identity & { flags: F }
) {
    return {
        _id: identity._id,
        auth: identity.auth,
        name: identity.name,
        discrim: identity.discrim,
        fullUsername: identity.fullUsername,
        locale: identity.locale,
        flags: identity.flags,
        lastDataRequest: null,
        avatar: identity.avatar,
        preferences: {
            customGlobalCss: "",
            defaultColour: "#BA2EFF",
            defaultForegroundColour: "#ffffff",
            enableGames: true,
            experiments: false,
            theme: 0,
            hideNSFW: false
        },
        profile: {
            bio: "",
            css: "",
            links: {
                website: "",
                github: "",
                gitlab: "",
                twitter: "",
                instagram: "",
                snapchat: ""
            }
        },
        game: {
            snakes: {
                maxScore: 0
            }
        },
        rank: {
            admin: false,
            assistant: false,
            mod: false,
            premium: false,
            tester: false,
            translator: false,
            covid: false
        },
        staffTracking: {
            details: {
                away: {
                    status: false,
                    message: ""
                },
                standing: "Unmeasured",
                country: "",
                timezone: "",
                managementNotes: "",
                languages: []
            },
            lastLogin: 0,
            lastAccessed: {
                time: 0,
                page: ""
            },
            punishments: {
                strikes: [],
                warnings: []
            },
            handledBots: noneHandled(),
            handledServers: noneHandled(),
            handledTemplates: noneHandled()
        }
    } satisfies Omit<delUser, "flags"> & { flags: F };
}

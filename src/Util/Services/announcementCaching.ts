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

import type { Request } from "express";

global.announcement = {
    active: false,
    message: "",
    colour: "",
    foreground: ""
} as any;

export function getAnnouncement() {
    return global.announcement;
}

export async function updateAnnouncement(announcement, req: Request) {
    await global.db.collection("webOptions").updateOne(
        { _id: "announcement" },
        {
            $set: {
                active: announcement.active,
                message: announcement.message,
                colour: announcement.colour,
                foreground: announcement.foreground
            }
        }
    );

    let type: string;
    announcement.active
        ? (type = "UPDATE_ANNOUNCEMENT")
        : (type = "RESET_ANNOUNCEMENT");

    await global.db.collection("audit").insertOne({
        type: type,
        executor: req.user.id,
        target: "announcement",
        date: Date.now(),
        reason: req.body.reason || "None specified.",
        details: {
            old: {
                announcement: {
                    active: global.announcement.active,
                    message: global.announcement.message,
                    colour: global.announcement.colour,
                    foreground: global.announcement.foreground
                }
            },
            new: {
                announcement: {
                    active: announcement.active,
                    message: announcement.message,
                    colour: announcement.colour,
                    foreground: announcement.foreground
                }
            }
        }
    });

    global.announcement = {
        active: announcement.active,
        message: announcement.message,
        colour: announcement.colour,
        foreground: announcement.foreground
    } as any;
}

export async function updateCache() {
    global.announcement = await global.db
        .collection<announcement>("webOptions")
        .findOne({ _id: "announcement" });
    return;
}

setInterval(async () => {
    await updateCache();
}, 60000);

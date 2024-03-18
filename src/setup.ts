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

import { libs } from "../node_modules/lib-comparison/libs";

async function setup () {
    for (const lib of libs) {
        await global.db
            .collection("libraries")
            .updateOne(
                { _id: lib.name },
                {
                    $set: {
                        _id: lib.name,
                        language: lib.language,
                        link: lib.url
                    }
                },
                { upsert: true }
            )
            .then(() => true)
            .catch(console.error);
    }

    if (
        !(await global.db
            .collection("webOptions")
            .findOne({ _id: "announcement" }))
    ) {
        await global.db
            .collection<announcement>("webOptions")
            .insertOne({
                _id: "announcement",
                active: false,
                message: "",
                colour: "",
                foreground: ""
            })
            .then(() => true)
            .catch(() => false);
    }
}

export default setup;
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

import * as crypto from "crypto";

export async function tokenResetAll() {
    const users: delUser[] = await global.db
        .collection("users")
        .find()
        .toArray();

    const tokenRefreshing = await global.db
        .collection("webOptions")
        .findOne({ _id: "tokenRefreshing" });

    if (!tokenRefreshing) {
        const validUntil = (Date.now() + 300000);

        return await global.db.collection("webOptions").insertOne({
            _id: "tokenRefreshing",
            lastUpdate: Date.now(),
            validUntil: validUntil
        });
    }

    if (tokenRefreshing.validUntil <= Date.now()) {
        const validUntil = (Date.now() + 300000);

        await global.db.collection("webOptions").updateOne(
            { _id: "tokenRefreshing" },
            {
                $set: {
                    lastUpdate: Date.now(),
                    validUntil: validUntil
                }
            }
        );

        for (const user of users) {
            if (user.rank.admin === true) {
                const token = await global.db
                    .collection("adminTokens")
                    .findOne({ _id: user._id });

                if (!token) {
                    await global.db.collection("adminTokens").insertOne({
                        _id: user._id,
                        token: "DELadminKey_" +
                            crypto.randomBytes(16).toString("hex") +
                            `-${user._id}`,
                        lastUpdate: Date.now(),
                        validUntil: validUntil
                    });
                } else {
                    await global.db.collection("adminTokens").updateOne(
                        { _id: user._id },
                        {
                            $set: {
                                token: "DELadminKey_" +
                                    crypto.randomBytes(16).toString("hex") +
                                    `-${user._id}`,
                                lastUpdate: Date.now(),
                                validUntil: validUntil
                            }
                        }
                    );
                }
            }
        }
    }
}

export async function tokenReset(id: string) {
    const token = await global.db
        .collection("adminTokens")
        .findOne({ _id: id });

    if (!token) {
        return await global.db.collection("adminTokens").insertOne({
            _id: id,
            token: "DELadminKey_" +
                crypto.randomBytes(16).toString("hex") +
                `-${id}`,
            lastUpdate: Date.now()
        });
    } else {
        return await global.db.collection("adminTokens").updateOne(
            { _id: id },
            {
                $set: {
                    token: "DELadminKey_" +
                        crypto.randomBytes(16).toString("hex") +
                        `-${id}`,
                    lastUpdate: Date.now()
                }
            }
        );
    }
}

export async function verifyToken(id: string, token: string) {
    const adminToken = await global.db
            .collection("adminTokens")
            .findOne({ _id: id });
    
    if (!adminToken) return false;

    let pass = false;
    adminToken.token === token && adminToken._id === id ? pass = true : pass = false;
    return pass
}

setInterval(async () => {
    await tokenResetAll();
}, 30000);

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

import express from "express";
import * as discord from "../Util/Services/discord.ts";
import * as botCache from "../Util/Services/botCaching.ts";
import * as serverCache from "../Util/Services/serverCaching.ts";
import * as templateCache from "../Util/Services/templateCaching.ts";
import * as userCache from "../Util/Services/userCaching.ts";
import { escapeFormatting } from "../Util/Function/format.ts";
import { makeURLSearchParams, OAuth2Scopes, Routes } from "discord.js";
import type {
    APITemplate,
    RESTGetAPIInviteQuery,
    APIApplicationCommand,
    APIApplication,
    RESTGetAPIInviteResult
} from "discord.js";
import settings from "../../settings.json" with { type: "json" };
import { logWebsiteAction } from "../Util/Function/websiteLog.ts";
import {
    fetchSlashCommands,
    fetchUserFlags
} from "../Util/Function/botListing.ts";
import { reasonEmbed } from "../Util/Function/staffActions.ts";
import { syncedServerFields } from "../Util/Function/serverRecords.ts";
import { syncedTemplateFields } from "../Util/Function/templateRecords.ts";

const router = express.Router();

const getNext = (arr: string[], id: string) => {
    const index = arr.indexOf(id);

    let nextIndex: number;
    if (index === arr.length - 1) {
        nextIndex = 0;
    } else nextIndex = index + 1;

    return arr[nextIndex];
};

router.get("/bots", async (_req, res) => {
    let id = await global.redis?.hget("autosync", "nextBot");

    const ids = (await global.redis?.hkeys("bots")).sort();
    if (!ids) return res.sendStatus(503);

    if (!id) id = ids[0];

    const botExists: delBot | null = await global.db
        .collection<delBot>("bots")
        .findOne({ _id: id });

    if (botExists)
        try {
            const app = (await discord.bot.rest.get(
                `/applications/${botExists.clientID || id}/rpc`
            )) as APIApplication;
            let commands: APIApplicationCommand[] = botExists.commands || [];

            if (botExists.scopes?.slashCommands) {
                // Fall back to the database on a cache miss, like the
                // variables middleware. If the owner can't be found at all,
                // only the command refresh is skipped; the rest still syncs.
                const owner =
                    (await userCache.getUser(botExists.owner.id)) ??
                    (await global.db
                        .collection<delUser>("users")
                        .findOne({ _id: botExists.owner.id }));

                if (
                    owner?.auth?.scopes?.includes(
                        OAuth2Scopes.ApplicationsCommandsUpdate
                    )
                )
                    // Refresh errors are ignored here: there's no one to show
                    // them to.
                    commands = await fetchSlashCommands(
                        owner,
                        true,
                        app.id,
                        commands
                    );
            }

            const userFlags = await fetchUserFlags(botExists.scopes?.bot, id);

            await global.db.collection("bots").updateOne(
                { _id: id },
                {
                    $set: {
                        name: app.name,
                        icon: {
                            hash: app.icon,
                            url: `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon}`
                        },
                        commands,
                        userFlags
                    } satisfies Partial<delBot>
                }
            );

            await botCache.updateBot(id);

            if (app.bot_public === false) throw "Bot is not public";
        } catch (e) {
            if (!botExists.status.archived && !botExists.status.siteBot)
                await discord.channels.alerts.send(
                    `${settings.emoji.warn} failed to autosync bot **${botExists.name}** \`(${id})\`: ${e}\n<${settings.website.url}/bots/${id}>`
                );
        }

    await global.redis?.hset("autosync", "nextBot", getNext(ids, id));

    res.sendStatus(200);
});

router.get("/servers", async (_req, res) => {
    let id = await global.redis?.hget("autosync", "nextServer");

    const ids = (await global.redis?.hkeys("servers")).sort();
    if (!ids) return res.sendStatus(503);

    if (!id) id = ids[0];

    const server: delServer | null = await global.db
        .collection<delServer>("servers")
        .findOne({ _id: id });

    if (server)
        try {
            const invite = (await discord.bot.rest.get(
                Routes.invite(server.inviteCode),
                {
                    query: makeURLSearchParams({
                        // Makes approximate_presence_count and
                        // approximate_member_count always present on the invite.
                        with_counts: true,
                        with_expiration: true
                    } satisfies RESTGetAPIInviteQuery)
                }
            )) as RESTGetAPIInviteResult;
            // A group-DM invite has no guild. Throwing takes the same path as
            // the TypeError reading invite.guild.id used to: the server is
            // removed as having an invalid invite.
            if (!invite.guild) throw new Error("Invite isn't for a server");
            if (invite.guild.id !== server._id) throw 3350001; // Invite points to a different server
            if (invite.expires_at) throw 3350002; // This invite is set to expire

            await global.db.collection("servers").updateOne(
                { _id: id },
                {
                    $set: syncedServerFields(invite, invite.guild)
                }
            );

            await serverCache.updateServer(id);
        } catch (e) {
            if (
                e != 3350001 &&
                e != 3350002 &&
                (e as { code?: unknown }).code != 10006
            ) {
                // https://discord.com/developers/docs/topics/opcodes-and-status-codes#json
                await global.db.collection("servers").deleteOne({ _id: id });
                await global.db.collection("audit").insertOne({
                    type: "REMOVE_SERVER",
                    executor: "AutoSync",
                    target: id,
                    date: Date.now(),
                    reason: "Failed to autosync server, assuming the invite is invalid, for another server, or can expire.",
                    reasonType: 5
                });

                await serverCache.deleteServer(id);

                const embed = reasonEmbed(
                    "Failed to autosync server, assuming the invite is invalid, for another server, or can expire."
                );

                await logWebsiteAction(
                    "AutoSync System",
                    settings.emoji.delete,
                    "removed server",
                    server.name,
                    server._id,
                    { embeds: [embed] }
                );

                await discord.messageMember(
                    server.owner.id,
                    `${
                        settings.emoji.delete
                    } **|** Your server **${escapeFormatting(
                        server.name
                    )}** \`(${server._id})\` has been removed!\n**Reason:** \`Our AutoSync system has determined this server has either been deleted, or the invite provided to us has expired. If your server is still active, please repost it with a permanent invite!\``
                );

                await discord.postWebMetric("server");
            }
        }

    await global.redis?.hset("autosync", "nextServer", getNext(ids, id));

    res.sendStatus(200);
});

router.get("/templates", async (_req, res) => {
    let id = await global.redis?.hget("autosync", "nextTemplate");

    const ids = (await global.redis?.hkeys("templates")).sort();
    if (!ids) return res.sendStatus(503);

    if (!id) id = ids[0];

    const dbTemplate: delTemplate | null = await global.db
        .collection<delTemplate>("templates")
        .findOne({ _id: id });

    if (dbTemplate)
        try {
            const template = (await discord.bot.rest.get(
                Routes.template(id)
            )) as APITemplate;

            await global.db.collection("templates").updateOne(
                { _id: id },
                {
                    $set: syncedTemplateFields(template)
                }
            );

            await templateCache.updateTemplate(id);
        } catch (e) {
            if ((e as { code?: unknown }).code == 10057) {
                // https://discord.com/developers/docs/topics/opcodes-and-status-codes#json
                // may as well reduce the load on web mods - AJ
                await global.db.collection("templates").deleteOne({ _id: id });

                await global.db.collection("audit").insertOne({
                    type: "REMOVE_TEMPLATE",
                    executor: "AutoSync",
                    target: id,
                    date: Date.now(),
                    reason: "Unknown server template (10057)",
                    reasonType: 4
                });

                await templateCache.deleteTemplate(id);

                const embed = reasonEmbed(
                    "Failed to autosync template, assuming the template is invalid."
                );

                await logWebsiteAction(
                    "AutoSync System",
                    settings.emoji.delete,
                    "removed template",
                    dbTemplate.name,
                    id,
                    { embeds: [embed] }
                );

                await discord.messageMember(
                    dbTemplate.creator.id,
                    `${
                        settings.emoji.delete
                    } **|** Your template **${escapeFormatting(
                        dbTemplate.name
                    )}** \`(${id})\` has been removed!\n**Reason:** \`Our AutoSync system has determined this template has been deleted from discord.\``
                );

                await discord.postWebMetric("template");
            }
        }

    await global.redis?.hset("autosync", "nextTemplate", getNext(ids, id));

    res.sendStatus(200);
});

export default router;

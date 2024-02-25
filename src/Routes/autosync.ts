/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020 Carolina Mitchell, John Burke, Advaith Jagathesan

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
import fetch from "node-fetch";
import refresh from "passport-oauth2-refresh";
import * as discord from "../Util/Services/discord.js";
import * as botCache from "../Util/Services/botCaching.js";
import * as serverCache from "../Util/Services/serverCaching.js";
import * as templateCache from "../Util/Services/templateCaching.js";
import * as userCache from "../Util/Services/userCaching.js";
import * as functions from "../Util/Function/main.js";
import { EmbedBuilder, RESTGetAPIInviteResult, makeURLSearchParams, OAuth2Scopes, Routes } from "discord.js";
import type { APITemplate, RESTGetAPIInviteQuery, RESTPostOAuth2AccessTokenResult, APIApplicationCommand, APIApplication, APIUser } from "discord.js";
import settings from "../../settings.json" assert { type: "json" };
import { DAPI } from "../Util/Services/discord.js"

const router = express.Router();

const getNext = (arr: string[], id: string) => {
    const index = arr.indexOf(id)

    let nextIndex: number
    if (index === arr.length - 1) {
        nextIndex = 0
    } else nextIndex = index + 1

    return arr[nextIndex]
}

router.get('/bots', async (req, res) => {
    let id = await global.redis?.hget("autosync", "nextBot")

    const ids = (await global.redis?.hkeys("bots")).sort()
    if (!ids) return res.sendStatus(503)

    if (!id) id = ids[0]

    const botExists: delBot = await global.db
        .collection<delBot>("bots")
        .findOne({ _id: id });

    if (botExists) try {
        const app = await discord.bot.rest.get(`/applications/${botExists.clientID || id}/rpc`) as APIApplication
        let commands: APIApplicationCommand[] = botExists.commands || []

        if (botExists.scopes?.slashCommands) {
            const owner = await userCache.getUser(botExists.owner.id)

            if (owner.auth?.scopes?.includes(OAuth2Scopes.ApplicationsCommandsUpdate)) {
                if (Date.now() > owner.auth.expires) {
                    await refresh.requestNewAccessToken('discord', owner.auth.refreshToken, async (err, accessToken, refreshToken, result: RESTPostOAuth2AccessTokenResult) => {
                        if (!err) {
                            await global.db.collection("users").updateOne(
                                { _id: owner._id },
                                {
                                    $set: {
                                        auth: {
                                            accessToken,
                                            refreshToken,
                                            expires: Date.now() + result.expires_in * 1000
                                        }
                                    }
                                }
                            );
                            await userCache.updateUser(owner._id)
                        }
                    })
                }

                const receivedCommands = await (await fetch(DAPI + Routes.applicationCommands(app.id), { headers: { authorization: `Bearer ${owner.auth.accessToken}` } })).json().catch(() => { }) as APIApplicationCommand[]
                if (Array.isArray(receivedCommands)) commands = receivedCommands;
            }
        }

        let userFlags = 0

        if (botExists.scopes?.bot) {
            const user = await discord.bot.rest.get(Routes.user(id)).catch(() => { }) as APIUser
            if (user.public_flags) userFlags = user.public_flags
        }

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

        if (app.bot_public === false) throw 'Bot is not public'
    } catch (e) {
        if (!botExists.status.archived) discord.channels.alerts.send(`${settings.emoji.warn} failed to autosync bot **${botExists.name}** \`(${id})\`: ${e}\n<${settings.website.url}/bots/${id}>`)
    }

    await global.redis?.hset("autosync", "nextBot", getNext(ids, id))

    res.sendStatus(200)
})

router.get('/servers', async (req, res) => {
    let id = await global.redis?.hget("autosync", "nextServer")

    const ids = (await global.redis?.hkeys("servers")).sort()
    if (!ids) return res.sendStatus(503)

    if (!id) id = ids[0]

    const server: delServer = await global.db
        .collection<delServer>("servers")
        .findOne({ _id: id });

    if (server) try {
        const invite = await discord.bot.rest.get(Routes.invite(server.inviteCode), {
            query: makeURLSearchParams({ with_counts: true, with_expiration: true } satisfies RESTGetAPIInviteQuery)
        }) as RESTGetAPIInviteResult
        if (invite.guild.id !== server._id) throw 'Invite points to a different server'
        if (invite.expires_at) throw 'This invite is set to expire'

        await global.db.collection("servers").updateOne(
            { _id: id },
            {
                $set: {
                    name: invite.guild.name,
                    counts: {
                        online: invite.approximate_presence_count,
                        members: invite.approximate_member_count
                    },
                    icon: {
                        hash: invite.guild.icon,
                        url: `https://cdn.discordapp.com/icons/${invite.guild.id}/${invite.guild.icon}`
                    }
                } satisfies Partial<delServer>
            }
        );

        await serverCache.updateServer(id);
    } catch (e) {
        if (e.code != 10006) return; // https://discord.com/developers/docs/topics/opcodes-and-status-codes#json
        await global.db.collection("servers").deleteOne({ _id: id });
        await global.db.collection("audit").insertOne({
            type: "REMOVE_SERVER",
            executor: "AutoSync",
            target: id,
            date: Date.now(),
            reason: "Failed to autosync server, assuming the invite is invalid.",
            reasonType: 5
        });

        await serverCache.deleteServer(id);

        const embed = new EmbedBuilder();
        embed.setColor(0x2f3136);
        embed.setTitle("Reason");
        embed.setDescription(req.body.reason);

        discord.channels.alerts.send({
            content: `${settings.emoji.delete} **AutoSync System** removed server **${functions.escapeFormatting(
                server.name
            )}** \`(${server._id})\``,
            embeds: [embed]
        });

        const owner = await discord.getMember(server.owner.id);
        if (owner)
            owner
                .send(
                    `${settings.emoji.delete
                    } **|** Your server **${functions.escapeFormatting(
                        server.name
                    )}** \`(${server._id})\` has been removed!\n**Reason:** \`Our AutoSync system has determined this server has either been deleted, or the invite provided to us has expired. If your server is still active, please repost it with a permanent invite!\``
                )
                .catch((e: string) => {
                    console.error(e);
                });

        await discord.postWebMetric("server");
    }

    await global.redis?.hset("autosync", "nextServer", getNext(ids, id))

    res.sendStatus(200)
})

router.get('/templates', async (req, res) => {
    let id = await global.redis?.hget("autosync", "nextTemplate")

    const ids = (await global.redis?.hkeys("templates")).sort()
    if (!ids) return res.sendStatus(503)

    if (!id) id = ids[0]

    const dbTemplate: delTemplate = await global.db
        .collection<delTemplate>("templates")
        .findOne({ _id: id });

    if (dbTemplate) try {
        const template = await discord.bot.rest.get(Routes.template(id)) as APITemplate

        await global.db.collection("templates").updateOne(
            { _id: id },
            {
                $set: {
                    name: template.name,
                    region: template.serialized_source_guild.region,
                    locale: template.serialized_source_guild
                        .preferred_locale,
                    afkTimeout: template.serialized_source_guild.afk_timeout,
                    verificationLevel: template.serialized_source_guild
                        .verification_level,
                    defaultMessageNotifications: template.serialized_source_guild
                        .default_message_notifications,
                    explicitContent: template.serialized_source_guild
                        .explicit_content_filter,
                    roles: template.serialized_source_guild.roles.map(c => { return { name: c.name, color: c.color }; }),
                    channels: template.serialized_source_guild.channels.map(c => { return { name: c.name, type: c.type, nsfw: c.nsfw }; }),
                    usageCount: template.usage_count,
                    creator: {
                        id: template.creator.id,
                        username: template.creator.username,
                        discriminator: template.creator.discriminator
                    },
                    icon: {
                        hash: template.serialized_source_guild.icon_hash,
                        url: `https://cdn.discordapp.com/icons/${template.source_guild_id}/${template.serialized_source_guild.icon_hash}`
                    }
                } satisfies Partial<delTemplate>
            }
        );

        await templateCache.updateTemplate(id);
    } catch (e) {
        if (e.code == 10057) return; // https://discord.com/developers/docs/topics/opcodes-and-status-codes#json
        // may as well reduce the load on web mods - AJ
        await global.db
            .collection("templates")
            .deleteOne({ _id: id });

        await global.db.collection("audit").insertOne({
            type: "REMOVE_TEMPLATE",
            executor: "AutoSync",
            target: id,
            date: Date.now(),
            reason: "Unknown server template (10057)",
            reasonType: 4
        });

        await templateCache.deleteTemplate(id);

        const embed = new EmbedBuilder();
        embed.setColor(0x2f3136);
        embed.setTitle("Reason");
        embed.setDescription(req.body.reason);

        discord.channels.alerts.send({
            content: `${settings.emoji.delete} **AutoSync System** removed template **${functions.escapeFormatting(
                dbTemplate.name
            )}** \`(${id})\``,
            embeds: [embed]
        });

        const owner = await discord.getMember(dbTemplate.creator.id);
        if (owner)
            owner
                .send(
                    `${settings.emoji.delete
                    } **|** Your template **${functions.escapeFormatting(
                        dbTemplate.name
                    )}** \`(${id
                    })\` has been removed!\n**Reason:** \`Our AutoSync system has determined this template has been deleted from discord.\``
                )
                .catch((e) => {
                    console.error(e);
                });

        await discord.postWebMetric("template");
    }

    await global.redis?.hset("autosync", "nextTemplate", getNext(ids, id))

    res.sendStatus(200)
})

export default router;

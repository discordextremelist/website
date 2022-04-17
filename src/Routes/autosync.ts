/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020 Carolina Mitchell-Acason, John Burke, Advaith Jagathesan

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
import { APIInvite, APITemplate, RESTGetAPIInviteQuery, RESTPostOAuth2AccessTokenResult, APIApplicationCommand, OAuth2Scopes, Routes, APIApplication, APIUser } from "discord-api-types/v10";
import settings from "../../settings.json" assert { type: "json" };

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
        const app = await discord.bot.api.applications(botExists.clientID || id).rpc.get() as APIApplication

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
                                            expires: Date.now() + result.expires_in*1000
                                        }
                                    }
                                }
                            );
                            await userCache.updateUser(owner._id)
                        }
                    })
                }
    
                const receivedCommands = await (await fetch('https://discord.com/api/v8'+Routes.applicationCommands(app.id), {headers: {authorization: `Bearer ${owner.auth.accessToken}`}})).json().catch(() => {}) as APIApplicationCommand[]
                if (Array.isArray(receivedCommands)) commands = receivedCommands;
            }
        }

        let userFlags = 0

        if (botExists.scopes?.bot) {
            const user = await discord.bot.api.users(id).get().catch(() => {}) as APIUser
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
                } as delBot
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
        const invite = await discord.bot.api.invites(server.inviteCode).get({query: {with_counts: true, with_expiration: true} as RESTGetAPIInviteQuery}) as APIInvite

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
                } as delServer
            }
        );

        await serverCache.updateServer(id);
    } catch (e) {
        discord.channels.alerts.send(`${settings.emoji.warn} failed to autosync server **${server.name}** \`(${id})\`: ${e}\n<${settings.website.url}/servers/${id}>`)
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
        const template = await discord.bot.api.guilds.templates(id).get() as APITemplate
        
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
                } as unknown as delTemplate
            }
        );

        await templateCache.updateTemplate(id);
    } catch (e) {
        discord.channels.alerts.send(`${settings.emoji.warn} failed to autosync template **${dbTemplate.name}** \`(${id})\`: ${e}\n<${settings.website.url}/templates/${id}>`)
    }

    await global.redis?.hset("autosync", "nextTemplate", getNext(ids, id))

    res.sendStatus(200)
})

export default router;

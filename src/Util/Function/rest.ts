
import { REST } from '@discordjs/rest';
import settings from "../../../settings.json" assert { type: "json" };

// Create rest client
export const rest = new REST({version: '10'}).setToken(settings.secrets.discord.token)

// Custom exportable functions below (if any)
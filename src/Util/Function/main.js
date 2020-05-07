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

const escapeFormatting = (text) => {
    const unescaped = text.replace(/\\(\*|_|`|~|\\)/g, '$1');
    const escaped = unescaped.replace(/(\*|_|`|~|\\)/g, '\\$1');
    return escaped;
}

function parseRegion(region) {
    let parsedRegion = `🏴 ${region}`;

    if (region === "us-west") parsedRegion = "🇺🇸 US West";
    if (region === "us-east") parsedRegion = "🇺🇸 US East";
    if (region === "us-central") parsedRegion = "🇺🇸 US Central";
    if (region === "us-south") parsedRegion = "🇺🇸 US South";
    if (region === "singapore") parsedRegion = "🇸🇬 Singapore";
    if (region === "southafrica") parsedRegion = "🇿🇦 South Africa";
    if (region === "sydney") parsedRegion = "🇦🇺 Sydney, AUS";
    if (region === "europe") parsedRegion = "🇪🇺 Europe";
    if (region === "hongkong") parsedRegion = "🇭🇰 Hong Kong";
    if (region === "russia") parsedRegion = "🇷🇺 Russia";
    if (region === "japan") parsedRegion = "🇯🇵 Japan";
    if (region === "india") parsedRegion = "🇮🇳 India";
    if (region === "dubai") parsedRegion = "🇦🇪 Dubai, UAE";
    if (region === "amsterdam") parsedRegion = "🇳🇱 Amsterdam, NL";
    if (region === "london") parsedRegion = "🏴󠁧󠁢󠁥󠁮󠁧󠁿 London, EN";
    if (region === "frankfurt") parsedRegion = "🇩🇪 Frankfurt, DE";
    if (region === "eu-central") parsedRegion = "🇪🇺 Central Europe";
    if (region === "eu-west") parsedRegion = "🇪🇺 Western Europe";

    return parsedRegion;
}

module.exports = {
    escapeFormatting, parseRegion
}
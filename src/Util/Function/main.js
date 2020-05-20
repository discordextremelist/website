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

    if (region === "us-west") parsedRegion = "US West";
    if (region === "us-east") parsedRegion = "US East";
    if (region === "us-central") parsedRegion = "US Central";
    if (region === "us-south") parsedRegion = "US South";
    if (region === "singapore") parsedRegion = "Singapore";
    if (region === "southafrica") parsedRegion = "South Africa";
    if (region === "sydney") parsedRegion = "Sydney";
    if (region === "europe") parsedRegion = "Europe";
    if (region === "hongkong") parsedRegion = "Hong Kong";
    if (region === "russia") parsedRegion = "Russia";
    if (region === "japan") parsedRegion = "Japan";
    if (region === "india") parsedRegion = "India";
    if (region === "dubai") parsedRegion = "Dubai";
    if (region === "amsterdam") parsedRegion = "Amsterdam";
    if (region === "london") parsedRegion = "London";
    if (region === "frankfurt") parsedRegion = "Frankfurt";
    if (region === "eu-central") parsedRegion = "Central Europe";
    if (region === "eu-west") parsedRegion = "Western Europe";
    if (region === "south-korea") parsedRegion = "South Korea";

    return parsedRegion;
}

function regionIcon(region) {
    let icon = "81b90eae4fc67502d59808a7c219ee65";

    if (region === "us-west") icon = "e6d6b255259ac878d00819a9555072ad";
    if (region === "us-east") icon = "e6d6b255259ac878d00819a9555072ad";
    if (region === "us-central") icon = "e6d6b255259ac878d00819a9555072ad";
    if (region === "us-south") icon = "e6d6b255259ac878d00819a9555072ad";
    if (region === "singapore") icon = "92cd1f9eabd48ec32dc2ecef617f706b";
    if (region === "southafrica") icon = "3a3ec02f3c9193e85bda10f5d2a42574";
    if (region === "sydney") icon = "1d8d4e2b3fd0e542b6d37cbfa156d55e";
    if (region === "europe") icon = "554a8e1a41c2e30cdb946396d3d336f2";
    if (region === "hongkong") icon = "a92f116201fa7ff2b4acbb39f144ec60";
    if (region === "russia") icon = "64f37efd5319b9b581557604864f042a";
    if (region === "japan") icon = "f23c5c28c4429691f7c54af93876d661";
    if (region === "india") icon = "716d569d0bca379a84578572c6efc7ac";
    if (region === "dubai") icon = "0113e92896135807e30f5de869074733";
    if (region === "amsterdam") icon = "c9f51873ae719a6b4b8c6724362e999e";
    if (region === "london") icon = "3a79cdd1d4af225247f2ba574b97ae78";
    if (region === "frankfurt") icon = "7fa2adf98f26db34178bb30a63dabe8c";
    if (region === "eu-central") icon = "554a8e1a41c2e30cdb946396d3d336f2";
    if (region === "eu-west") icon = "554a8e1a41c2e30cdb946396d3d336f2";

    return icon;
}

function getForeground(inputColour) {
    const colour = (inputColour.charAt(0) === '#') ? inputColour.substring(1, 7) : inputColour;
    const R = parseInt(colour.substring(0, 2), 16);
    const G = parseInt(colour.substring(2, 4), 16);
    const B = parseInt(colour.substring(4, 6), 16);
    const uiColours = [R / 255, G / 255, B / 255];
    const c = uiColours.map((col) => {
        if (col <= 0.03928) {
            return col / 12.92;
        }
        return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    const L = (0.2126 * c[0]) + (0.7152 * c[1]) + (0.0722 * c[2]);
    return (L > 0.179) ? "#000000" : "#FFFFFF";
}

module.exports = {
    escapeFormatting,
    parseRegion,
    regionIcon,
    getForeground
}
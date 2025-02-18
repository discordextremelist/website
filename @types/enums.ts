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

export enum themes {
    black,
    dark,
    light
}

export enum botReasons {
    other,
    isClone,
    fixRefusal,
    fixNoResponse,
    notFixed,
    errOnInvite,
    tokenLeak,
    massDM,
    discordTosViolation,
    tosViolation,
    cantContactOwner,
    invalidPrivacyPolicy,
    invalidDesc,
    offline,
    discontinued,
    shitBot,
    serverLimit
}

export enum serverReasons {
    other,
    innapAvatarName,
    discordTosViolation,
    tosViolation,
    notLGBT,
    invalidInvite
}

export enum templateReasons {
    other,
    innapAvatarName,
    discordTosViolation,
    tosViolation
}
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

// Moved verbatim from src/Routes/bots.ts, which was deleted once every bot
// route had been split out into src/Routes/bots/. Previously these were
// referenced from submit.ts/edit.ts/resubmit.ts with no import at all, behind
// a // @ts-expect-error, which made every social-link validation throw
// ReferenceError at runtime.
//
// TODO(B-1): these are wrong as written. The /g flag makes .test() stateful
// via lastIndex, so repeat calls alternate true/false, and they are unanchored
// so "@bad@@@" satisfies bluesky. Left as-is deliberately to keep the move
// behaviour-preserving; fix in the socials follow-up PR.
export const patterns = {
    mastodon: /@[A-Za-z0-9.]+@[A-Za-z0-9.]+/gi,
    bluesky: /@[A-Za-z0-9.]+/gi,
    gitlab: /https:\/\/[A-Za-z0-9.]+\/[A-Za-z0-9._-]+/gi,
    forgejo: /https:\/\/[A-Za-z0-9.]+\/[A-Za-z0-9._-]+/gi
};

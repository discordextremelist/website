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

export function shuffleArray<T>(array: T[]) {
    let currentIndex = array.length,
        temporaryValue,
        randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

/** Listings and the audit log show this many entries a page. */
export const PAGE_SIZE = 15;

/** The entries on page `page` (counted from 1, as ?page= sends it). */
export function pageOf<T>(items: T[], page: unknown): T[] {
    return items.slice(
        PAGE_SIZE * Number(page) - PAGE_SIZE,
        PAGE_SIZE * Number(page)
    );
}

/** How many pages `count` entries fill. */
export function pageCount(count: number) {
    return Math.ceil(count / PAGE_SIZE);
}

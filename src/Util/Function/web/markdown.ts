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

// Markdown rendering: one markdown-it instance with the default options, which
// every page used, shared instead of one per module.

import mdi from "markdown-it";
import entities from "html-entities";

const md = new mdi();

/** Render markdown to HTML. */
export function renderMarkdown(text: string) {
    return md.render(text);
}

/**
 * A listing's long description as HTML, still to be sanitised: the markdown
 * rendered, then its HTML entities decoded.
 */
export function renderLongDescription(text: string) {
    return entities.decode(md.render(text));
}

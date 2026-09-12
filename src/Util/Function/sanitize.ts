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

import sanitizeHtml from "sanitize-html";
import htmlRef from "../../../htmlReference.json" with { type: "json" };

/**
 * Bot long descriptions: the standard tag set, disallowed tags escaped,
 * and every iframe sandboxed.
 */
export function sanitizeBotHtml(dirty: string): string {
    return sanitizeHtml(dirty, {
        allowedTags: htmlRef.standard.tags,
        allowedAttributes: htmlRef.standard.attributes,
        allowVulnerableTags: true,
        disallowedTagsMode: "recursiveEscape",
        transformTags: {
            iframe: function (_tagName, attribs) {
                attribs.sandbox = "";
                return {
                    tagName: "iframe",
                    attribs: attribs
                };
            }
        }
    });
}

/**
 * Server and template long descriptions on their public pages: the minimal
 * tag set, with disallowed tags discarded (sanitize-html's default mode).
 * This differs from sanitizeMinimalHtmlEscaped on purpose, to keep the current
 * behaviour. See ISSUES I-10.
 */
export function sanitizeMinimalHtml(dirty: string): string {
    return sanitizeHtml(dirty, {
        allowedTags: htmlRef.minimal.tags,
        allowedAttributes: htmlRef.minimal.attributes,
        allowVulnerableTags: true
    });
}

/**
 * Server and template long descriptions on their edit pages: the minimal
 * tag set, with disallowed tags escaped.
 */
export function sanitizeMinimalHtmlEscaped(dirty: string): string {
    return sanitizeHtml(dirty, {
        allowedTags: htmlRef.minimal.tags,
        allowedAttributes: htmlRef.minimal.attributes,
        allowVulnerableTags: true,
        disallowedTagsMode: "recursiveEscape"
    });
}

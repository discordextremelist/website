/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020-2024 Carolina Mitchell, John Burke, Advaith Jagathesan

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

import { readFileSync } from "node:fs";
import path from "node:path";
import mdi from "markdown-it";

import settings from "../../../settings.json" assert { type: "json" };

const md = new mdi();

const legalMarkdown = ["terms", "privacy"];
const prefix = "legalMarkdown";

export async function getFile(file: string) {
    return await global.redis?.hget(prefix, file);
}

export async function updateCache() {
    for (const item of legalMarkdown) {
        const file = readFileSync(
            path.join(process.cwd() + `/assets/Markdown/${item}.md`)
        );
        await global.redis?.hmset(prefix, item, md.render(file.toString()));
    }

    for (const locale of settings.website.locales.all) {
        const file = readFileSync(
            path.join(
                process.cwd() +
                    `/node_modules/del-i18n/website/files/${locale}/guidelines.md`
            )
        );
        await global.redis?.hmset(
            prefix,
            "guidelines-" + locale,
            md.render(file.toString())
        );
    }
}

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

import type { Request, Response } from "express";

import settings from "../../../settings.json" with { type: "json" };

import * as botCache from "../../Util/Services/botCaching.ts";
import * as serverCache from "../../Util/Services/serverCaching.ts";
import * as templateCache from "../../Util/Services/templateCaching.ts";
import * as userCache from "../../Util/Services/userCaching.ts";

const base = settings.website.url;

const url = (path: string, lang: string) =>
    `<url>
        <loc>${base}/${lang}${path}</loc>
        <xhtml:link rel="alternate" hreflang="en"    href="${base}/en-US${path}"/>
        <xhtml:link rel="alternate" hreflang="en-us" href="${base}/en-US${path}"/>
        <xhtml:link rel="alternate" hreflang="en-gb" href="${base}/en-GB${path}"/>
        <xhtml:link rel="alternate" hreflang="en-nz" href="${base}/en-NZ${path}"/>
        <xhtml:link rel="alternate" hreflang="de"    href="${base}/de-DE${path}"/>
        <xhtml:link rel="alternate" hreflang="de-de" href="${base}/de-DE${path}"/>
        <xhtml:link rel="alternate" hreflang="fr"    href="${base}/fr-FR${path}"/>
        <xhtml:link rel="alternate" hreflang="fr-fr" href="${base}/fr-FR${path}"/>
        <xhtml:link rel="alternate" hreflang="pt"    href="${base}/pt-PT${path}"/>
        <xhtml:link rel="alternate" hreflang="pt-pt" href="${base}/pt-PT${path}"/>
        <xhtml:link rel="alternate" hreflang="es"    href="${base}/es-ES${path}"/>
        <xhtml:link rel="alternate" hreflang="es-es" href="${base}/es-ES${path}"/>
        <xhtml:link rel="alternate" hreflang="he"    href="${base}/he-IL${path}"/>
        <xhtml:link rel="alternate" hreflang="he-il" href="${base}/he-IL${path}"/>
        <xhtml:link rel="alternate" hreflang="hu"    href="${base}/hu-HU${path}"/>
        <xhtml:link rel="alternate" hreflang="hu-hu" href="${base}/hu-HU${path}"/>
        <xhtml:link rel="alternate" hreflang="tr"    href="${base}/tr-TR${path}"/>
        <xhtml:link rel="alternate" hreflang="tr-tr" href="${base}/tr-TR${path}"/>
        <xhtml:link rel="alternate" hreflang="sv"    href="${base}/sv-SE${path}"/>
        <xhtml:link rel="alternate" hreflang="sv-SE" href="${base}/sv-SE${path}"/>
        <xhtml:link rel="alternate" hreflang="it"    href="${base}/it-IT${path}"/>
        <xhtml:link rel="alternate" hreflang="it-IT" href="${base}/it-IT${path}"/>
    </url>`;

export const sitemapGenerator = async (
    req: Request,
    res: Response
) => {
    const lang = req.params.lang;
    const bots = await botCache.getAllBots();
    const servers = await serverCache.getAllServers();
    const templates = await templateCache.getAllTemplates();
    const users = await userCache.getAllUsers();
    res.set("Content-Type", "text/xml");

    res.send(
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"> 
    ${url("", lang)}
    ${url("/bots", lang)}
    ${url("/servers", lang)}
    ${url("/templates", lang)}
    ${url("/search", lang)}
    ${url("/widgetbot", lang)}
    ${url("/docs", lang)}
    ${url("/about", lang)}
    ${url("/terms", lang)}
    ${url("/privacy", lang)}
    ${url("/cookies", lang)}
    ${url("/guidelines", lang)}
    ${url("/auth/login", lang)}
    ${bots
        .filter(
            (b) =>
                b.status.approved &&
                !b.status.archived &&
                !b.status.hidden &&
                !b.status.modHidden
        )
        .map((b) => url(`/bots/${b.vanityUrl || b._id}`, lang))
        .join("\n    ")}
    ${servers.map((s) => url(`/servers/${s._id}`, lang)).join("\n    ")}
    ${templates.map((t) => url(`/templates/${t._id}`, lang)).join("\n    ")}
    ${users.map((u) => url(`/users/${u._id}`, lang)).join("\n    ")}
</urlset>`
    );
};

export const sitemapIndex = async (
    _req: Request,
    res: Response
) => {
    res.set("Content-Type", "text/xml");

    res.send(
        `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
    ${settings.website.locales.all
        .map(
            (l) =>
                `<sitemap>
        <loc>${base}/${l}/sitemap.xml</loc>
    </sitemap>`
        )
        .join("\n     ")}
</sitemapindex>`
    );
};

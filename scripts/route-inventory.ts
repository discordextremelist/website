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

/*
 * Prints every route declared under src/Routes/, one per line, as:
 *
 *     METHOD  /mount/path  [middleware, chain]
 *
 * Diff the output before and after a refactor to prove that a move really was
 * a move. There is no test suite, so for steps 3 and 4 of the backend
 * refactor this is the only mechanical evidence that the route surface did not
 * change.
 *
 * Deliberately STATIC: it reads source text rather than importing the route
 * modules. Importing them would pull in settings.json, the Discord client and
 * the Mongo/Redis globals, none of which exist at lint time.
 *
 * Usage:
 *     node --experimental-transform-types scripts/route-inventory.ts
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

const ROUTES_DIR = join(process.cwd(), "src", "Routes");
const METHODS = "get|post|put|patch|delete";

/** Where a given route file's router gets mounted in src/app.ts. */
function mountPoints(): Map<string, string> {
    const app = readFileSync(join(process.cwd(), "src", "app.ts"), "utf8");
    const mounts = new Map<string, string>();

    // import xRoute from "./Routes/servers.ts";  /  import { initBotRoutes } from "./Routes/bots/index.ts";
    const imports = new Map<string, string>();
    for (const m of app.matchAll(
        /import\s+(?:(\w+)|\{\s*(\w+)[^}]*\})\s+from\s+"\.\/(Routes\/[\w/]+)\.ts"/g
    )) {
        imports.set(m[1] ?? m[2], m[3]);
    }

    // app.use("/:lang/servers", serversRoute);  /  app.use("/:lang/bots", initBotRoutes());
    for (const m of app.matchAll(
        /app\.use\(\s*"([^"]+)"\s*,\s*(\w+)\s*\(?\)?\s*\)/g
    )) {
        const file = imports.get(m[2]);
        if (file) mounts.set(file, m[1]);
    }
    return mounts;
}

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (entry.endsWith(".ts")) out.push(full);
    }
    return out;
}

/**
 * Resolve a route file back to the app.ts mount that serves it, e.g.
 * src/Routes/bots/_id/edit.ts -> the mount registered for Routes/bots/index.
 */
function mountFor(file: string, mounts: Map<string, string>): string {
    const rel = relative(process.cwd(), file)
        .replace(/\.ts$/, "")
        .split(sep)
        .join("/")
        .replace(/^src\//, "");

    if (mounts.has(rel)) return mounts.get(rel)!;

    // A file inside a resource directory is served by that directory's index.
    let dir = rel.replace(/\/[^/]+$/, "");
    while (dir.includes("/")) {
        if (mounts.has(`${dir}/index`)) return mounts.get(`${dir}/index`)!;
        dir = dir.replace(/\/[^/]+$/, "");
    }
    return "<unmounted>";
}

/** Split on commas that are not nested inside (), [] or {}. */
function splitTopLevel(raw: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of raw) {
        if (ch === "(" || ch === "[" || ch === "{") depth++;
        else if (ch === ")" || ch === "]" || ch === "}") depth--;
        if (ch === "," && depth === 0) {
            parts.push(current);
            current = "";
        } else current += ch;
    }
    parts.push(current);
    return parts;
}

/** Normalise a middleware chain so formatting churn doesn't show up as a diff. */
function chain(raw: string): string {
    const names = splitTopLevel(raw)
        // Collapse whitespace, so an argument Prettier wraps over several lines
        // still prints on one row.
        .map((s) =>
            s
                .trim()
                .replace(/\s+/g, " ")
                .replace(/\(\s+/g, "(")
                .replace(/\s+\)/g, ")")
        )
        // Drop the import-namespace prefix: `permission.auth` and a bare `auth`
        // are the same middleware, and which one a file uses is not behaviour.
        .map((s) => s.replace(/^(?:permission|checks|functions|middleware)\./, ""))
        .filter((s) => s && !s.startsWith("async") && !s.startsWith("("));
    return names.length ? `[${names.join(", ")}]` : "[]";
}

const mounts = mountPoints();
const rows: string[] = [];

for (const file of walk(ROUTES_DIR)) {
    const src = readFileSync(file, "utf8");
    // Strip comments so commented-out routes are never counted.
    const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
    const mount = mountFor(file, mounts);

    // Plain express: router.get("/:id/edit", variables, permission.auth, async (req...
    for (const m of code.matchAll(
        new RegExp(
            `router\\.(${METHODS})\\(\\s*"([^"]*)"\\s*(?:,([\\s\\S]*?))?(?:async|\\(req|\\(_req)`,
            "g"
        )
    )) {
        rows.push(
            `${m[1].toUpperCase().padEnd(6)} ${(mount + m[2]).padEnd(44)} ${chain(m[3] ?? "")}`
        );
    }

    // PathRoute subclass: super("get", "/:id/edit", [variables, permission.auth])
    for (const m of code.matchAll(
        new RegExp(`super\\(\\s*"(${METHODS})"\\s*,\\s*"([^"]*)"\\s*,\\s*\\[`, "g")
    )) {
        // Walk forward from the opening bracket, balancing nesting, so an entry
        // like permission.scopes([OAuth2Scopes.GuildsJoin]) is not truncated.
        let depth = 1;
        let i = m.index! + m[0].length;
        const start = i;
        while (i < code.length && depth > 0) {
            if (code[i] === "[") depth++;
            else if (code[i] === "]") depth--;
            i++;
        }
        rows.push(
            `${m[1].toUpperCase().padEnd(6)} ${(mount + m[2]).padEnd(44)} ${chain(code.slice(start, i - 1))}`
        );
    }
}

rows.sort();
console.log(rows.join("\n"));
console.error(`${rows.length} routes`);

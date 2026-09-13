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

// Writing audit log entries. Kept apart from audit.ts (displaying them) so
// the caches can record entries without importing other caches.

type AuditEntry = {
    type: string;
    executor: string;
    target?: string;
    reason: string;
    reasonType?: number;
    details?: unknown;
};

/**
 * Add an entry to the audit log, stamped with the current time. The fields are
 * stored in the order entries have always had: type, executor, target, date,
 * reason, reasonType, details. A field is stored whenever it's passed, even as
 * undefined, and left out when it isn't. Returns the insert's promise.
 */
export function recordAudit(entry: AuditEntry) {
    const doc: Record<string, unknown> = {
        type: entry.type,
        executor: entry.executor
    };
    if ("target" in entry) doc.target = entry.target;
    doc.date = Date.now();
    doc.reason = entry.reason;
    if ("reasonType" in entry) doc.reasonType = entry.reasonType;
    if ("details" in entry) doc.details = entry.details;
    return global.db.collection("audit").insertOne(doc);
}

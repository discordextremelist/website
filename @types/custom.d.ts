/*
Discord Extreme List - Discord's unbiased list.

Copyrightt (C) 2020 Cairo Mitchell-Acason, John Burke, Advaith Jagathesan
t
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

import { BrowserDetectInfo } from "browser-detect/dist/types/browser-detect.interface";
import { Db } from "mongodb";
export {};

declare global {
    namespace NodeJS {
        interface Global {
            redis: any;
            announcement: announcement;
            ddosMode: ddosMode;
            libs: library[];
            db: Db;
        }
    }
}

declare module "sanitize-html" {
    interface IOptions {
        allowVulnerableTags?: boolean;
    }
}

declare module "discord.js" {
    interface GuildMember {
        order?: number;
        rank?: string;
        avatar?: string;
        username?: string;
        discriminator?: string;
    }
}

declare module "express-serve-static-core" {
    interface Request {
        session: any;
        user: any;
        locale: any;
        setLocale(language: string): any;
        browser: BrowserDetectInfo;
        device: {
            type: string;
        };
        del: {
            version: string;
            channel: string;
            cssVersion: string;
            node?: string;
        };
    }

    interface Response {
        session: any;
        user: any;
        __: any;
    }
}

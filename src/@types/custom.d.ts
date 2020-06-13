/*
Discord Extreme List - Discord's unbiased list.

Copyright (C) 2020 Cairo Mitchell-Acason, John Burke, Advaith Jagathesan

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

import { Db } from "mongodb";
import { BrowserDetectInfo } from "browser-detect/dist/types/browser-detect.interface";
export {}

declare module NodeJS {
    interface Global {
        redis: any;
        announcement: announcement;
        ddosMode: ddosMode;
        libs: library[];
        db: Db;
    }
}

declare module "express-serve-static-core" {
    interface Request {
        session: any,
        user: any,
        browser: BrowserDetectInfo,
        device: {
            type: string
        },
        del: {
            version: string,
            channel: string,
            cssVersion: string,
            node?: string
        }
    }

    interface Response {
        session: any,
        user: any,
        __: i18n
    }
}

declare module "app" {
    interface app {
        db: Db
    }
}

type i18n = (phraseOrOptions: string | i18n.TranslateOptions, ...replace: string[]) => string;


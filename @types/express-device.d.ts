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

declare module "express-device" {
    export const namespace: string;

    export const version: string;

    export function Parser(user_agent: any, options: any): any;

    export function capture(options?: any): any;

    export function customCheck(req: any, mydevice: any): any;

    export function enableDeviceHelpers(app: any): any;

    export function enableViewRouting(app: any, options: any): any;
}

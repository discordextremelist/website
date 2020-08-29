declare module "express-device" {
    export const namespace: string;

    export const version: string;

    export function Parser(user_agent: any, options: any): any;

    export function capture(options?: any): any;

    export function customCheck(req: any, mydevice: any): any;

    export function enableDeviceHelpers(app: any): any;

    export function enableViewRouting(app: any, options: any): any;
}

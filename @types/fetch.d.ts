// // taken and modified from https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/node-fetch/index.d.ts

// import FormData = require("form-data");
// import { URLSearchParams } from "url";

// export class Headers implements Iterable<[string, string]> {
//     constructor(init?: HeadersInit);
//     forEach(callback: (value: string, name: string) => void): void;
//     append(name: string, value: string): void;
//     delete(name: string): void;
//     get(name: string): string | null;
//     has(name: string): boolean;
//     raw(): { [k: string]: string[] };
//     set(name: string, value: string): void;

//     // Iterable methods
//     entries(): IterableIterator<[string, string]>;
//     keys(): IterableIterator<string>;
//     values(): IterableIterator<[string]>;
//     [Symbol.iterator](): Iterator<[string, string]>;
// }

// type BlobPart = ArrayBuffer | ArrayBufferView | Blob | string;

// interface BlobOptions {
//     type?: string;
//     endings?: "transparent" | "native";
// }

// export class Blob {
//     constructor(blobParts?: BlobPart[], options?: BlobOptions);
//     readonly type: string;
//     readonly size: number;
//     slice(start?: number, end?: number): Blob;
// }

// export class Body {
//     constructor(body?: any, opts?: { size?: number; timeout?: number });
//     arrayBuffer(): Promise<ArrayBuffer>;
//     blob(): Promise<Blob>;
//     body: NodeJS.ReadableStream;
//     bodyUsed: boolean;
//     buffer(): Promise<Buffer>;
//     json(): Promise<any>;
//     size: number;
//     text(): Promise<string>;
//     textConverted(): Promise<string>;
//     timeout: number;
// }

// export class Response extends Body {
//     constructor(body?: BodyInit, init?: ResponseInit);
//     static error(): Response;
//     static redirect(url: string, status: number): Response;
//     clone(): Response;
//     headers: Headers;
//     ok: boolean;
//     redirected: boolean;
//     status: number;
//     statusText: string;
//     type: ResponseType;
//     url: string;
// }

// export type ResponseType =
//     | "basic"
//     | "cors"
//     | "default"
//     | "error"
//     | "opaque"
//     | "opaqueredirect";

// export interface ResponseInit {
//     headers?: HeadersInit;
//     size?: number;
//     status?: number;
//     statusText?: string;
//     timeout?: number;
//     url?: string;
// }

// export type HeadersInit = Headers | string[][] | { [key: string]: string };

// export type BodyInit =
//     | ArrayBuffer
//     | ArrayBufferView
//     | NodeJS.ReadableStream
//     | string
//     | URLSearchParams
//     | FormData;

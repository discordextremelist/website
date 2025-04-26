import type { Request, Response } from "express";

export type Nullable<T> = T | null;

export type BotTags = "slashcommands" | "fun" | "social" | "economy" | "utility" | "moderation" | "multipurpose" | "music";

export type BotQueryTagFilterParams = {
    icon: string;
    title: string;
    subtitle: (res: Response) => string;
    filter: (bot: delBot, req: Request) => boolean;
};

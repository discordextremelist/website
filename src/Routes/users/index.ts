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

import express, { type Router } from "express";
import { GetUser } from "./_id/get.ts";
import { GetUserRank, PostUserRank } from "./_id/rank.ts";
import { UserSrc, SessionSrc } from "./_id/src.ts";
import { GetEditProfile, PostEditProfile } from "./_id/profile.ts";
import { SyncUser } from "./_id/sync.ts";
import {
    GetSnake,
    GetSnakeLeaderboard,
    GetProfileSnakes,
    PostProfileSnakes
} from "./game.ts";
import {
    GetPreferences,
    PostPreferences,
    ResetPreferences
} from "./preferences.ts";
import {
    GetAccountData,
    RequestAccountData,
    DeleteOwnAccountData,
    DeleteUserAccountData
} from "./data.ts";

export const initUserRoutes = (): Router => {
    const router = express.Router();
    new GetUser().register(router);
    new GetUserRank().register(router);
    new PostUserRank().register(router);
    new UserSrc().register(router);
    new SessionSrc().register(router);
    new GetEditProfile().register(router);
    new PostEditProfile().register(router);
    new SyncUser().register(router);
    new GetSnake().register(router);
    new GetSnakeLeaderboard().register(router);
    new GetProfileSnakes().register(router);
    new PostProfileSnakes().register(router);
    new GetPreferences().register(router);
    new PostPreferences().register(router);
    new ResetPreferences().register(router);
    new GetAccountData().register(router);
    new RequestAccountData().register(router);
    new DeleteOwnAccountData().register(router);
    new DeleteUserAccountData().register(router);
    return router;
};

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

import { AuthedPathRoute } from "../../route.ts";
import type { Response } from "express";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import * as userCache from "../../../Util/Services/cache/userCaching.ts";
import { resolveMe, userExists } from "../../../Util/Middleware/checks.ts";
import { recordAudit } from "../../../Util/Function/staff/recordAudit.ts";

export class GetEditProfile extends AuthedPathRoute<"get"> {
    constructor() {
        super("get", "/profile/:id/edit", [
            variables,
            permission.auth,
            resolveMe,
            userExists,
            permission.selfOrAssistant("common.error.user.perms.edit")
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const userProfile = req.attached.user!;

        res.locals.premidPageInfo = res.__(
            "premid.user.edit",
            userProfile.fullUsername
        );

        res.render("templates/users/editProfile", {
            title: res.__("page.users.edit.title"),
            subtitle: res.__(
                "page.users.edit.subtitle",
                req.user.db.fullUsername
            ),
            req,
            userProfile: userProfile
        });
    }
}

export class PostEditProfile extends AuthedPathRoute<"post"> {
    constructor() {
        super("post", "/profile/:id/edit", [
            variables,
            permission.auth,
            resolveMe,
            userExists,
            permission.selfOrAssistant("common.error.user.perms.edit")
        ]);
    }

    async handle(req: AuthedRequest, res: Response) {
        const userProfile = req.attached.user!;

        let customCss: string = "";
        if (
            userProfile.rank.premium ||
            userProfile.rank.mod ||
            userProfile.rank.assistant ||
            userProfile.rank.admin
        ) {
            customCss = req.body.profileCss;
        }

        await global.db.collection("users").updateOne(
            { _id: req.params.id },
            {
                $set: {
                    profile: {
                        bio: req.body.bio,
                        css: customCss,
                        links: {
                            website: req.body.website,
                            github: req.body.github,
                            gitlab: req.body.gitlab,
                            twitter: req.body.twitter,
                            instagram: req.body.instagram,
                            snapchat: req.body.snapchat
                        }
                    }
                }
            }
        );

        await recordAudit({
            type: "MODIFY_PROFILE",
            executor: req.user.id,
            target: userProfile._id,
            reason: req.body.reason || "None specified.",
            details: {
                old: {
                    bio: userProfile.profile.bio,
                    css: userProfile.profile.css,
                    links: {
                        website: userProfile.profile.links.website,
                        github: userProfile.profile.links.github,
                        gitlab: userProfile.profile.links.gitlab,
                        twitter: userProfile.profile.links.twitter,
                        instagram: userProfile.profile.links.instagram,
                        snapchat: userProfile.profile.links.snapchat
                    }
                },
                new: {
                    bio: req.body.bio,
                    css: customCss,
                    links: {
                        website: req.body.website,
                        github: req.body.github,
                        gitlab: req.body.gitlab,
                        twitter: req.body.twitter,
                        instagram: req.body.instagram,
                        snapchat: req.body.snapchat
                    }
                }
            }
        });
        await userCache.updateUser(req.params.id);

        res.redirect(`/users/${req.params.id}`);
    }
}

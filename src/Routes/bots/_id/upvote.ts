import { PathRoute } from "../../route.ts";
import { variables } from "../../../Util/Middleware/variables.ts";
import * as permission from "../../../Util/Middleware/permissions.ts";
import e from "express";
import * as botCache from "../../../Util/Services/botCaching.ts";
import { botExists } from "../../../Util/Middleware/checks.ts";
import { renderStatus } from "../../../Util/Function/main.ts";

export class GetUpvote extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/upvote", [variables, permission.auth, botExists]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        const bot = req.attached.bot!;
        let upVotes = [...bot.votes.positive];
        let downVotes = [...bot.votes.negative];

        if (upVotes.includes(req.user.id) || downVotes.includes(req.user.id)) {
            if (upVotes.includes(req.user.id)) {
                let removeUser = upVotes.indexOf(req.user.id);
                while (removeUser > -1) {
                    upVotes.splice(removeUser, 1);
                    removeUser = upVotes.indexOf(req.user.id);
                }
            }

            if (downVotes.includes(req.user.id)) {
                let removeUser = downVotes.indexOf(req.user.id);
                while (removeUser > -1) {
                    downVotes.splice(removeUser, 1);
                    removeUser = downVotes.indexOf(req.user.id);
                }

                upVotes.push(req.user.id);
            }
        } else {
            upVotes.push(req.user.id);
        }

        if (bot.votes.positive.includes(req.user.id)) {
            await global.db.collection("audit").insertOne({
                type: "REMOVE_UPVOTE_BOT",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: "None specified.",
                details: {
                    old: {
                        votes: {
                            positive: bot.votes.positive,
                            negative: bot.votes.negative
                        }
                    },
                    new: {
                        votes: {
                            positive: upVotes,
                            negative: downVotes
                        }
                    }
                }
            });
        } else {
            await global.db.collection("audit").insertOne({
                type: "UPVOTE_BOT",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: "None specified.",
                details: {
                    old: {
                        votes: {
                            positive: bot.votes.positive,
                            negative: bot.votes.negative
                        }
                    },
                    new: {
                        votes: {
                            positive: upVotes,
                            negative: downVotes
                        }
                    }
                }
            });
        }

        await global.db.collection("bots").updateOne(
            { _id: bot._id },
            {
                $set: {
                    votes: {
                        positive: upVotes,
                        negative: downVotes
                    }
                }
            }
        );

        await botCache.updateBot(<string>bot._id);

        res.redirect(`/bots/${bot._id}`);
    }
}

export class GetDownvote extends PathRoute<"get"> {
    constructor() {
        super("get", "/:id/downvote", [variables, permission.auth, botExists]);
    }

    async handle(req: e.Request, res: e.Response, next: e.NextFunction) {
        let bot = req.attached.bot!;
        if (!bot) {
            bot = await global.db
                .collection<delBot>("bots")
                .findOne({ vanityUrl: req.params.id });

            if (!bot)
                return renderStatus(
                    req,
                    res,
                    404,
                    res.__("common.error.bot.404")
                );
        }

        let upVotes = [...bot.votes.positive];
        let downVotes = [...bot.votes.negative];

        if (upVotes.includes(req.user.id) || downVotes.includes(req.user.id)) {
            if (downVotes.includes(req.user.id)) {
                let removeUser = downVotes.indexOf(req.user.id);
                while (removeUser > -1) {
                    downVotes.splice(removeUser, 1);
                    removeUser = downVotes.indexOf(req.user.id);
                }
            }

            if (upVotes.includes(req.user.id)) {
                let removeUser = upVotes.indexOf(req.user.id);
                while (removeUser > -1) {
                    upVotes.splice(removeUser, 1);
                    removeUser = upVotes.indexOf(req.user.id);
                }

                downVotes.push(req.user.id);
            }
        } else {
            downVotes.push(req.user.id);
        }

        await global.db.collection("bots").updateOne(
            { _id: bot._id },
            {
                $set: {
                    votes: {
                        positive: upVotes,
                        negative: downVotes
                    }
                }
            }
        );

        if (bot.votes.negative.includes(req.user.id)) {
            await global.db.collection("audit").insertOne({
                type: "REMOVE_DOWNVOTE_BOT",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: "None specified.",
                details: {
                    old: {
                        votes: {
                            positive: bot.votes.positive,
                            negative: bot.votes.negative
                        }
                    },
                    new: {
                        votes: {
                            positive: upVotes,
                            negative: downVotes
                        }
                    }
                }
            });
        } else {
            await global.db.collection("audit").insertOne({
                type: "DOWNVOTE_BOT",
                executor: req.user.id,
                target: req.params.id,
                date: Date.now(),
                reason: "None specified.",
                details: {
                    old: {
                        votes: {
                            positive: bot.votes.positive,
                            negative: bot.votes.negative
                        }
                    },
                    new: {
                        votes: {
                            positive: upVotes,
                            negative: downVotes
                        }
                    }
                }
            });
        }

        await botCache.updateBot(bot._id);

        res.redirect(`/bots/${bot._id}`);
    }
}

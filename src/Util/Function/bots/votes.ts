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

// Bot upvotes and downvotes.

type Direction = "up" | "down";
type Votes = delBot["votes"];

/** Remove every copy of `userId` from `list`, in place. */
function removeAll(list: string[], userId: string) {
    let index = list.indexOf(userId);
    while (index > -1) {
        list.splice(index, 1);
        index = list.indexOf(userId);
    }
}

/**
 * The bot's votes after `userId` votes `direction`. Voting the same way again
 * takes the vote back; voting the other way moves it across.
 */
export function castVote(
    bot: delBot,
    userId: string,
    direction: Direction
): Votes {
    const positive = [...bot.votes.positive];
    const negative = [...bot.votes.negative];
    const [same, other] =
        direction === "up" ? [positive, negative] : [negative, positive];

    if (same.includes(userId) || other.includes(userId)) {
        if (same.includes(userId)) removeAll(same, userId);

        if (other.includes(userId)) {
            removeAll(other, userId);
            same.push(userId);
        }
    } else {
        same.push(userId);
    }

    return { positive, negative };
}

/**
 * The audit entry for a vote: UPVOTE_BOT or DOWNVOTE_BOT, or REMOVE_… when
 * the user had already voted that way, with the votes before and after.
 */
export function voteAuditEntry(
    bot: delBot,
    userId: string,
    direction: Direction,
    target: string,
    votes: Votes
) {
    const word = direction === "up" ? "UPVOTE" : "DOWNVOTE";
    const before = direction === "up" ? bot.votes.positive : bot.votes.negative;

    return {
        type: before.includes(userId) ? `REMOVE_${word}_BOT` : `${word}_BOT`,
        executor: userId,
        target,
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
                    positive: votes.positive,
                    negative: votes.negative
                }
            }
        }
    };
}

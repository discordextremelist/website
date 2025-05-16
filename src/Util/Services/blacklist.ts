export async function blacklistCheck(id: string): Promise<boolean> {
    const botExists = await global.db
        .collection<delBot>("bots")
        .findOne({ $or: [{ _id: id}, { vanityUrl: id }] });
    console.log(botExists);
    if (!botExists) return false;
    return botExists.status.blacklist;
}

export async function blacklistUpdate(id: string, blacklisted: boolean) {
    const botExists = await global.db.collection<delBot>("bots")
        .findOne({ $or: [{ _id: id }, { vanityUrl: id }] });
    if (!botExists) return;
    await global.db.collection<delBot>("bots").updateOne({ $or: [{ _id: id }, { vanityUrl: id }] }, {
        $set: {
            "status.modHidden": blacklisted,
            "status.blacklist": blacklisted
        }
    });
}

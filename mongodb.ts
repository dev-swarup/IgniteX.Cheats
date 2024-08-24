import { MongoClient } from "mongodb";
const MongoDB = await (new MongoClient(process.env.MONGODB_URL as string)).connect(), db = MongoDB.db("MisteroCheats");

MongoDB.addListener("close",
    async () => setTimeout(async () => await MongoDB.connect(), 1000));

export { db };
export const status = (ip: string, userAgent: string): Promise<
    { status: true, nocheck?: boolean } | { status: false, err: string }
> => new Promise(async resolve => {
    if (await db.collection("whitelistAddress").findOne({ $or: [{ ip }, { userAgent }] }))
        resolve({ status: true, nocheck: true });

    else
        if (await db.collection("blacklistAddress").findOne({ $or: [{ ip }, { userAgent }] }))
            resolve({ status: false, err: "You have been banned. Please contact support for assistance." });

        else
            resolve({ status: true, nocheck: false });
});

export const addToBanlist = (ip: string, userAgent: string, user: string, reason: string, data: string) => new Promise(async resolve => {
    if (await db.collection("blacklistAddress").findOne({ $or: [{ ip }, { userAgent }] }))
        resolve(false);
    else
        resolve(await db.collection("blacklistAddress").insertOne({ ip: ip || "not_reachable", user, data, reason, userAgent, time: `${(new Date()).toDateString()} ${(new Date()).toTimeString()}` }));
});


export const loginUser = (user: string, pass: string, seller: string, device: string): Promise<
    { status: true, data: { codes: string, locations: Array<string>, license: Array<{ name: string, page: string, time: number | "LIFETIME" }>, expiry: number | "LIFETIME" } } | { status: false, err: string }
> => new Promise(async resolve => {
    if (user || pass)
        try {
            const client = await db.collection("clients").findOne({ user, seller }); if (client)
                if (client.pass === pass)
                    if (client.device === '-' || client.device === '*' || client.device === device) {
                        const currentTime = (new Date()).getTime();
                        const activeLicenses = client.license.map(([page, name, time]) => {
                            if (time === "LIFETIME")
                                return { status: true, page, name, time: "LIFETIME" };

                            else
                                return currentTime < time ? { status: true, page, name, time } : { status: false };
                        }).filter(e => e.status).sort((i, e) => e.time === "LIFETIME" ? i.time === "LIFETIME" ? 1 : 1 : e.time - i.time);

                        if (activeLicenses.length == 0)
                            return resolve({ status: false, err: "Your subscription has expired. Please renew to continue using the panel." });

                        if (client.device === '-')
                            try {
                                await db.collection("clients").findOneAndReplace({ _id: client._id }, { ...client, device });
                            } catch (err) {
                                console.log(err);
                                return resolve({ status: false, err: "Device registration failed. Please try again or contact the seller for assistance." });
                            }

                        const licenses = {};
                        activeLicenses.forEach(({ page, name }) => licenses[page] ? licenses[page].push(name.replace("-LEGIT", "")) : licenses[page] = [name.replace("-LEGIT", "")]);

                        try {
                            const codes = {};
                            (await db.collection("cheats").find({}).toArray()).map(doc => {
                                if (doc.type == "EXTRA")
                                    /// @ts-expect-error
                                    if (doc._id == "RESET-GUEST")
                                        return doc;

                                if (doc.type in licenses)
                                    if (licenses[doc.type].includes("ALL") || licenses[doc.type].includes(doc._id))
                                        return doc.codes.length > 0 ? doc : false;
                                    else
                                        return false;
                                else
                                    return false;
                            })
                                /// @ts-expect-error
                                .filter(e => e).forEach(doc => doc.type !== "EXPERIMENTAL" ? codes[doc._id] = doc : codes[`EXPERIMENTAL | ${doc._id}`] = doc);

                            return resolve({
                                status: true, data: {
                                    codes: Buffer.from(Buffer
                                        .from(JSON.stringify(codes), "utf8").toString("base64url").split("").reverse().join(""), "utf8").toString("hex"), locations: client.locations, license: activeLicenses.map(e => ({ page: e.page, name: e.name })), expiry: activeLicenses.at(0).time
                                }
                            });
                        } catch (err) {
                            console.log(err);
                            return resolve({ status: false, err: "Unable to create a session. Please try again." });
                        };
                    } else
                        return resolve({ status: false, err: "This device isn't registered. Please contact the seller to reset your device access." });
                else
                    return resolve({ status: false, err: "Incorrect password. Please try again." });
            else
                return resolve({ status: false, err: "This username isn't registered. Ask the seller to add you." });
        } catch (err) {
            console.log(err);
            return resolve({ status: false, err: "There was an error while searching for the username. Please try again later." });
        }
    else
        return resolve({ status: false, err: "Please enter both username and password to proceed." });
});
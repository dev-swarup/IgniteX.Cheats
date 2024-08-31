const MongoClient = (await (new ((await import("mongodb")).MongoClient)(process.env.MONGODB_URL as string)).connect())
    .addListener("close", async () => setTimeout(async () => await MongoClient.connect(), 1000)), db = MongoClient.db("Ignite X Cheats");

const cheats = db.collection("cheats");
const clients = db.collection("clients");
const whitelistedAddress = db.collection("whitelistedAddress");
const blacklistedAddress = db.collection("blacklistedAddress");

export { db };
export const userAgent = (cpu_model: string, cpu_cores: number, totalmem: number, version: string) => {
    return Buffer.from(Buffer.from(Buffer.from(JSON.stringify({ cpu_model, cpu_cores, totalmem, version }), "utf8")
        .toString("base64url").split(" ").reverse().join("~"), "utf8").toString("binary").split(" ").reverse().join("~"), "utf8").toString("base64url");
};

export const statusCheck = (ip: string, userAgent: string): Promise<{ status: true, whitelisted: boolean } | { status: false, err: string }> => new Promise(async resolve => {
    if (await whitelistedAddress.findOne({ $and: [{ $or: [{ ip: "*" }, { ip }] }, { $or: [{ userAgent: "*" }, { userAgent }] }] }))
        resolve({ status: true, whitelisted: true });

    else
        if (await whitelistedAddress.findOne({ $or: [{ $or: [{ ip: "*" }, { ip }] }, { $or: [{ userAgent: "*" }, { userAgent }] }] }))
            resolve({ status: false, err: "You have been banned from the server. Please contact support if you believe this is an error." });

        else
            resolve({ status: true, whitelisted: false });
});

export const addThisUserToBlacklist = (ip: string, userAgent: string, user: string, reason: string, data: string) => new Promise(async resolve => {
    if (await blacklistedAddress.findOne({ $and: [{ $or: [{ ip: "*" }, { ip }] }, { $or: [{ userAgent: "*" }, { userAgent }] }] }))
        resolve({ status: false, err: "You have been banned from the server. Please contact support if you believe this is an error." });

    else {
        await blacklistedAddress.insertOne({ ip: ip || "*", user, data, reason, userAgent, time: `${(new Date()).toDateString()} ${(new Date()).toTimeString()}` });

        resolve(true)
    };
});

export const loginUser = (user: string, pass: string, seller: string, device: string): Promise<{ status: true, data: { codes: string, locations: Array<string>, license: Array<{ name: string, page: string, time: number | "LIFETIME" }>, expiry: number | "LIFETIME" } } | { status: false, err: string }> => new Promise(async resolve => {
    try {
        const client = await clients.findOne({ user, seller }); if (client)
            if (client.pass === pass)
                if (["*", "-", device].includes(client.device)) {
                    const currentTime = (new Date()).getTime();
                    const activeLicenses = client.license.map(([page, name, time]) => {
                        if (time === "LIFETIME")
                            return { status: true, page, name, time: "LIFETIME" };

                        else
                            return currentTime <= time ? { status: true, page, name, time } : { status: false };
                    }).filter(e => e.status).sort((i, e) => e.time === "LIFETIME" ? i.time === "LIFETIME" ? 1 : 1 : e.time - i.time);

                    if (activeLicenses.length == 0)
                        return resolve({ status: false, err: "Your subscription has expired. Please renew to continue using the panel." });

                    if (client.device === "-")
                        try {
                            await clients.findOneAndReplace({ _id: client._id }, { ...client, device });
                        } catch (err) {
                            console.log(err);
                            return resolve({ status: false, err: "Device registration failed. Please try again or contact the seller for assistance." });
                        }

                    const licenses = {};
                    activeLicenses.forEach(({ page, name }) => licenses[page] ? licenses[page].push(name.replace("-LEGIT", "")) : licenses[page] = [name.replace("-LEGIT", "")]);

                    try {
                        const codes = {};
                        (await cheats.find({}).toArray()).map(doc => {
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
                                    .from(JSON.stringify(codes), "utf8").toString("base64url").split("").reverse().join("~"), "utf8").toString("hex"), locations: client.locations, license: activeLicenses.map(e => ({ page: e.page, name: e.name })), expiry: activeLicenses.at(0).time
                            }
                        });
                    } catch (err) {
                        console.log(err);
                        return resolve({ status: false, err: "Unable to create a session. Please try again." });
                    };
                } else
                    return resolve({
                        status: false, err: "This device isn't registered.Please contact the seller to reset your device access."
                    });
            else
                return resolve({ status: false, err: "Incorrect password. Please try again." });
        else
            return resolve({
                status: false, err: "This username isn't registered.Ask the seller to add you."
            });
    } catch (err) {
        console.log(err);
        return resolve({ status: false, err: "There was an error while searching for the username. Please try again later." });
    };
});
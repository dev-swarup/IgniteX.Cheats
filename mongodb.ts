import { MongoClient } from "mongodb";
const MongoDB = await (new MongoClient(process.env.MONGODB_URL as string)).connect(), db = MongoDB.db("MisteroCheats");

MongoDB.addListener("close",
    async () => setTimeout(async () => await MongoDB.connect(), 1000));


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
    console.log(`BAN REPORT : ${user} ${reason}`);

    if (await db.collection("blacklistAddress").findOne({ userAgent }))
        resolve(false);
    else
        resolve(await db.collection("blacklistAddress").insertOne({ ip, user, data, reason, userAgent, time: `${(new Date()).toDateString()} ${(new Date()).toTimeString()}` }));
});


export const loginUser = (user: string, pass: string, seller: string, device: string): Promise<
    { status: true, data: { authToken: string, license: Array<{ name: string, page: string, time: number | "LIFETIME" }>, expiry: number | "LIFETIME" } } | { status: false, err: string }
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
                            return resolve({ status: false, err: "Your subscription has expired. Please renew to continue using the service." });

                        if (client.device === '-')
                            try {
                                await db.collection("clients").findOneAndReplace({ _id: client._id }, { ...client, device });
                            } catch (err) {
                                console.log(err);
                                return resolve({ status: false, err: "Device registration failed. Please try again or contact the seller for assistance." });
                            }

                        try {
                            const session = {
                                user, seller, device, activeLicenses,
                                token: Buffer.from(`${device?.slice(0, 30)}+${client.user}+${currentTime}`).toString("base64url")
                            };

                            await db.collection("sessions").insertOne(session);
                            return resolve({ status: true, data: { authToken: session.token, license: activeLicenses.map(e => { return { page: e.page, name: e.name, time: e.time } }), expiry: activeLicenses.at(0).time } });
                        } catch (err) {
                            console.log(err);
                            return resolve({ status: false, err: "Unable to create session. Please try again." });
                        };
                    } else
                        return resolve({ status: false, err: "This device isn't registered. Please contact the seller to reset your device access." });
                else
                    return resolve({ status: false, err: "Incorrect password. Please try again." });
            else
                return resolve({ status: false, err: "🔍 Oops! That username isn't registered. Ask the seller to add you." });
        } catch (err) {
            console.log(err);
            return resolve({ status: false, err: "There was an error while searching for the username. Please try again later." });
        }
    else
        return resolve({ status: false, err: "Please enter both username and password to proceed." });
});

export const registerUser = (user: string, pass: string, seller: string, sellerAuth: string, sellerDevice: string): Promise<
    { status: true } | { status: false, err: string }
> => new Promise(async resolve => {
    if (user || pass)
        try {
            const client = await db.collection("sellers").findOne({ name: seller }); if (client) {
                if (client.pass === sellerAuth)
                    if (client.device === sellerDevice)
                        if (!(await db.collection("clients").findOne({ user, seller }))) {
                            try {
                                await db.collection("clients")
                                    .insertOne({ user, pass, seller, device: "-", license: [] });

                                return resolve({ status: true });
                            } catch (err) {
                                console.log(err);
                                return resolve({ status: false, err: "Failed to register username and password. Please try again or contact support." });
                            }
                        } else
                            return resolve({ status: false, err: "Username already exists. Please choose a different username." });
                    else
                        return resolve({ status: false, err: "This device isn't registered. Please contact the owner to reset your device access." });
                else
                    return resolve({ status: false, err: "Incorrect seller's password. Please try again." });
            } else
                return resolve({ status: false, err: "Seller not found. Please check the username or contact support for assistance." });
        } catch (err) {
            console.log(err);
            return resolve({ status: false, err: "There was an error while searching for the seller's username. Please try again later." });
        }
    else
        return resolve({ status: false, err: "Please enter both username and password to proceed." });
});

export const extractCheatCode = (code: string, authToken: string, device: string): Promise<
    { status: true, data: { status: boolean, data: Array<[string, string] | [string, string, string]> } } | { status: false, err: string }
> => new Promise(async resolve => {
    try {
        const session = await db.collection("sessions").findOne({ token: authToken }); if (session) {
            if (session.device === '*' || session.device === device) {
                const cheat = await db.collection("cheats").findOne({ name: code });

                if (cheat) {
                    let license = session.activeLicenses.find(e => e.name === "ALL" || e.name === code); if (license)
                        return resolve({ status: true, data: { status: cheat.status, data: cheat.data } });
                    else
                        return resolve({ status: false, err: "The requested cheat is not included in your subscription. Please upgrade to access it." });
                } else
                    return resolve({ status: false, err: "The requested cheat code is not ready yet. Please check back later." });
            } else
                return resolve({ status: false, err: "This device isn't registered. Please contact the owner to reset your device access." });
        } else
            return resolve({ status: false, err: "Your session has expired. Please re-login to continue." });
    } catch (err) {
        console.log(err);
        return resolve({ status: false, err: "Unable to verify session. Please try again." });
    };
});
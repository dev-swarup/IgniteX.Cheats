const MongoClient = (await (new ((await import("mongodb")).MongoClient)(process.env.MONGODB_URL as string))
    .connect()).addListener("close", async () => setTimeout(async () => await MongoClient.connect(), 1000)), db = MongoClient.db("MisteroCheats");

const cheats = db.collection("cheats");
const clients = db.collection("clients");
const whitelistedAddress = db.collection("whitelistedAddress");
const blacklistedAddress = db.collection("blacklistedAddress");

export { clients, cheats };
export const userAgent = (cpu_model: string, cpu_cores: string, totalmem: string, version: string) => {
    return Buffer.from(Buffer.from(Buffer.from(JSON.stringify({ cpu_model, cpu_cores, totalmem, version }), "utf8")
        .toString("base64url").split(" ").reverse().join("~"), "utf8").toString("binary").split(" ").reverse().join("~"), "utf8").toString("base64url");
};

export const statusCheck = (ip: string, userAgent: string): Promise<{ status: true, whitelisted: boolean } | { status: false, err: string }> => new Promise(async resolve => {
    if (await whitelistedAddress.findOne({ $or: [{ $or: [{ ip: "*" }, { ip }] }, { $or: [{ userAgent: "*" }, { userAgent }] }] }))
        resolve({ status: true, whitelisted: true });

    else
        if (await blacklistedAddress.findOne({ $or: [{ $or: [{ ip: "*" }, { ip }] }, { $or: [{ userAgent: "*" }, { userAgent }] }] }))
            resolve({ status: false, err: "Your device is banned." });

        else
            resolve({ status: true, whitelisted: false });
});
export const addThisUserToBlacklist = (ip: string, userAgent: string, actualUserAgent: string, user: string, reason: string, image: string) => new Promise(async resolve => {
    if (await blacklistedAddress.findOne({ $or: [{ $or: [{ ip: "*" }, { ip }] }, { $or: [{ userAgent: "*" }, { userAgent }] }] }))
        resolve({ status: false, err: "Your device is banned." });

    else {
        await blacklistedAddress.insertOne({ ip: ip || "*", user, reason, userAgent, device: actualUserAgent, time: `${(new Date()).toDateString()} ${(new Date()).toTimeString()}` });

        try {
            const data = new FormData();
            const [cpuModel, cpuThread, ram] = JSON.parse(actualUserAgent);

            data.append('file', new Blob([Uint8Array.from(atob(image), c => c.charCodeAt(0))], { type: 'image/png' }), "image.png");
            data.append('content', `### ${"`"} USERNAME ${"`"}\t${"```"}${user}${"```"}\n### ${"`"} BAN REASON ${"`"}\t${"```"}${reason}${"```"}\n\n### ${"`"} PUBLIC IP ${"`"}\t${"```"}${ip || "-"}${"```"}\n\n\n### ${"`"} DEVICE INFO ${"`"} ${"```"}${ram} RAM${"```"}\n### ${"```"}${cpuModel.replaceAll("  ", "").replaceAll("  ", "")}${"```"}`);

            await fetch(process.env.DISCORD_HOOK as string, { body: data, method: 'POST', });
        } catch (err) { console.log(err); }; resolve({ status: true });
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
                        return resolve({ status: false, err: "Subscription expired. Renew to continue." });

                    if (client.device === "-")
                        try {
                            await clients.findOneAndReplace({ _id: client._id }, { ...client, device });
                        } catch (err) {
                            console.log(err);
                            return resolve({ status: false, err: "Device Registration failed. Try again or contact seller." });
                        }

                    const licenses = {};
                    activeLicenses.forEach(({ page, name }) => {
                        name = name.replace("-LEGIT", "");

                        if (name == "AIMBOT") name = /AIMBOT\[v.*\]/;
                        licenses[page] ? licenses[page].push(name) : licenses[page] = [name];
                    });

                    try {
                        const codes = {};
                        (await cheats.find({}).toArray()).map(doc => {
                            if (doc.type == "EXTRA")
                                /// @ts-expect-error
                                if (doc._id == "RESET-GUEST" || doc._id == "CRASH-EMULATOR")
                                    return doc;

                            if (doc.type in licenses)
                                if (licenses[doc.type].includes("ALL") || licenses[doc.type].map(name => name.test ? name.test(doc._id) : name == doc._id).filter(e => e).length > 0)
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
                        return resolve({ status: false, err: "Unable to create session. Try again." });
                    };
                } else
                    return resolve({ status: false, err: "Device not registered. Contact seller to reset access." });
            else
                return resolve({ status: false, err: "Wrong password. Try again." });
        else
            return resolve({ status: false, err: "Username not registered. Ask seller to add you." });
    } catch (err) {
        console.log(err);
        return resolve({ status: false, err: "Error in searching username. Try again later." });
    };
});
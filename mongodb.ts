const MongoClient = (await (new ((await import("mongodb")).MongoClient)(process.env.MONGODB_URL as string))
    .connect()).addListener("close", async () => setTimeout(async () => await MongoClient.connect(), 1000)), db = MongoClient.db("db");

const cheats = db.collection("cheats");
const clients = db.collection("clients");
const whitelistedAddress = db.collection("whitelistedAddress");
const blacklistedAddress = db.collection("blacklistedAddress");

export const userAgent = (userAgent: string) => {
    return Buffer.from(Buffer.from(Buffer.from(userAgent).toString("base64")
        .split("").reverse().join(""), "utf8").toString("hex").split(" ").reverse().join("").concat(process.env.PORT as string), "utf8").toString("base64url");
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
        await blacklistedAddress.insertOne({ ip, user, reason, userAgent, device: actualUserAgent, time: `${(new Date()).toDateString()} ${(new Date()).toTimeString()}` });

        try {
            const data = new FormData();
            data.append('file', new Blob([Uint8Array.from(atob(image), c => c.charCodeAt(0))], { type: 'image/png' }), "image.png");

            let content = (user ? `## USERNAME${"```"}${user}${"```"}\n` : "")
                .concat(`## REASON FOR BAN${"```"}${reason}${"```"}\n\n\n`)

                .concat(`### IP${"```"}${ip}${"```"}\n`)
                .concat(`### DEVICE INFO${"```"}${actualUserAgent}${"```"}\n`);

            data.append('content', content.concat(`|| @here ||`));
            await fetch(process.env.DISCORD_URL as string, { body: data, method: 'POST', });
        } catch (err) { console.log(err); };

        resolve({ status: true });
    };
});


async function loadCheats(): Promise<Array<{
    id: string;
    name: string;
    page: string;
    isFree: boolean;

    cheats: Array<string>;
    status: "safe" | "warn" | "risk";
}>> {
    const records: Array<any> = [];
    (await cheats.find({}).map(({ _id: id, data }) => {
        /// @ts-expect-error
        const [page, name] = (id as string).split(".");

        return {
            page, name: name || "~", data: data.filter(({ cheats }) => cheats.length > 0).map(({ name: id, status, cheats }) => {
                const [price, name] = id.split("@"); return {
                    name, status, isFree: price == "FREE", cheats: cheats
                        .map(i => Buffer.from(Buffer.from(JSON.stringify(i)).toString("base64").split("").reverse().join("")).toString("hex"))
                };
            })
        };
    }).toArray())
        .filter(({ data }) => data.length > 0).forEach(({ name, page, data }) => records.push(...data.map(({ name: id, status, cheats, isFree }) => ({
            page, isFree, status, cheats,
            name: name == "~" ? id : name, id: `${name == "~" ? "" : name}${name == "~" ? id : `[${id}]`}`
        }))));

    return records;
};

let cheat_records = await loadCheats();
export const cheatListener = new ((await import("events")).EventEmitter)();


const cheats_stream = cheats.watch(); (async function timeoutStream() {
    cheats_stream.on("change", async ({ operationType }) => {
        if (["insert", "update", "replace"].includes(operationType))
            cheat_records = await loadCheats();
    });
})();


export const loginUser = (user: string, pass: string, seller: string, device: string): Promise<{
    status: true, data: {
        codes: Array<{
            name: string;
            page: string;
            data: Array<string>;
            status: "safe" | "warn" | "risk";
        }>, locations: Array<string>, license: Array<{ name: string, page: string, time: number | "LIFETIME" }>, expiry: number | "LIFETIME"
    }
} | { status: false, err: string }> => new Promise(async resolve => {
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

                    const licenses = {};
                    activeLicenses.forEach(({ page, name }) =>
                        licenses[page] ? licenses[page].push(name) : licenses[page] = [name]);

                    const codes = cheat_records.filter(({ name, page, isFree }) => {
                        if (("FREE" in licenses || activeLicenses.length > 0) && isFree)
                            return true;

                        if ("ALL" in licenses)
                            /// @ts-expect-error
                            return (licenses["ALL"].includes("ALL") || licenses[page].includes(name));

                        if (page in licenses)
                            return (licenses[page].includes("ALL") || licenses[page].includes(name));
                        else
                            return false;
                    }).map(({ id, page, status, cheats }) => ({ name: id, page, status, data: cheats }));

                    if (codes.length == 0 || activeLicenses.length == 0)
                        return resolve({ status: false, err: "Subscription expired. Renew to continue." });

                    const expiry = activeLicenses.at(0).time;
                    if (client.paidFor !== process.env.OB_VERSION && expiry == "LIFETIME")
                        return resolve({ status: false, err: "OB Subscription expired. Pay your OB Update Fee to continue." });

                    if (client.device === "-")
                        try {
                            await clients.findOneAndReplace({ _id: client._id }, { ...client, device });
                        } catch (err) { return resolve({ status: false, err: "Device Registration failed. Try again or contact seller." }); };

                    return resolve({ status: true, data: { locations: client.locations, license: activeLicenses.map(e => ({ page: e.page, name: e.name })), codes, expiry } });
                } else
                    return resolve({ status: false, err: "Device not registered. Contact seller to reset access." });
            else
                return resolve({ status: false, err: "Wrong password. Try again." });
        else
            return resolve({ status: false, err: "Username not registered. Ask seller to add you." });
    } catch (err) { console.log(err); return resolve({ status: false, err: "Error in searching username. Try again later." }); };
});
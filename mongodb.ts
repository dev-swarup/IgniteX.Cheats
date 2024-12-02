import { Env, UserAgent } from "./utils.ts";

const MongoClient = (await (new ((await import("mongodb")).MongoClient)(Env.mongodb_url))
    .connect()).addListener("close", async () => setTimeout(async () => await MongoClient.connect(), 1000)), db = MongoClient.db("db");


export class User {
    constructor() { };
    private static clients = db.collection("clients");
    private static whitelistedAddress = db.collection("whitelistedAddress");
    private static blacklistedAddress = db.collection("blacklistedAddress");


    static login(user: string, pass: string, seller: string, userAgent: UserAgent): Promise<{
        status: true, data: {
            codes: Array<{
                name: string;
                page: string;
                cheats: Array<string>;
                anticheats: Array<string>;
                status: "safe" | "warn" | "risk";
            }>, locations: Array<string>, license: Array<{ name: string, page: string, time: number | "LIFETIME" }>, expiry: number | "LIFETIME"
        }
    } | { status: false, err: string }> {
        return new Promise(async resolve => {
            try {
                const device = userAgent.encoded, client = await this.clients.findOne({ user, seller }); if (client)
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

                            const codes = Cheats.Record.filter(({ name, page, isFree }) => {
                                if (("FREE" in licenses || activeLicenses.length > 0) && isFree)
                                    return true;

                                if ("ALL" in licenses)
                                    /// @ts-expect-error
                                    return (licenses["ALL"].includes("ALL") || licenses[page].includes(name));

                                if (page in licenses)
                                    return (licenses[page].includes("ALL") || licenses[page].includes(name));
                                else
                                    return false;
                            }).map(data => ({ name: data.id, page: data.page, status: data.status, cheats: data.cheats, anticheats: data.anticheats }));

                            if (codes.length == 0 || activeLicenses.length == 0)
                                return resolve({ status: false, err: "Subscription expired. Renew to continue." });

                            const expiry = activeLicenses.at(0).time;
                            if (client.paidFor !== process.env.OB_VERSION && expiry == "LIFETIME")
                                return resolve({ status: false, err: "OB Subscription expired. Pay your OB Update Fee to continue." });

                            if (client.device === "-")
                                try {
                                    await this.clients.findOneAndReplace({ _id: client._id }, { ...client, device });
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
    };


    static register(user: string, pass: string, seller: string) {

    };


    static statusCheck = (ip: string, userAgent: UserAgent): Promise<{ status: true, whitelisted: boolean } | { status: false, err: string }> => new Promise(async resolve => {
        if (await this.whitelistedAddress.findOne({ $or: [{ $or: [{ ip: "*" }, { ip }] }, { $or: [{ userAgent: "*" }, { userAgent: userAgent.encoded }] }] }))
            resolve({ status: true, whitelisted: true });

        else
            if (await this.blacklistedAddress.findOne({ $or: [{ $or: [{ ip: "*" }, { ip }] }, { $or: [{ userAgent: "*" }, { userAgent: userAgent.encoded }] }] }))
                resolve({ status: false, err: "Your device is banned." });

            else
                resolve({ status: true, whitelisted: false });
    });
};


export class Cheats {
    constructor() { };
    private static cheats = db.collection("cheats");

    public static initRecord(): Promise<void> {
        return new Promise(async () => {
            const records: Array<any> = [];
            (await this.cheats.find({}).map(({ _id: id, data }) => {
                /// @ts-expect-error
                const [page, name] = (id as string).split(".");

                return {
                    page, name: name || "~", data: data.filter(({ cheats }) => cheats.length > 0).map(cheat => {
                        const [price, name] = cheat.name.split("@"); return {
                            name: name, status: cheat.status, isFree: price == "FREE",
                            cheats: cheat.cheats.map(i => Buffer.from(Buffer.from(JSON.stringify(i)).toString("base64").split("").reverse().join("")).toString("hex")),
                            ...(cheat.anticheats ? { anticheats: cheat.anticheats.map(i => Buffer.from(Buffer.from(JSON.stringify(i)).toString("base64").split("").reverse().join("")).toString("hex")) } : { anticheats: [] })
                        };
                    })
                };
            }).toArray())
                .filter(({ data }) => data.length > 0).forEach(({ name, page, data }) => records.push(...data.map(({ name: id, status, cheats, anticheats, isFree }) => ({
                    page, isFree, status, cheats, anticheats,
                    name: name == "~" ? id : name, id: `${name == "~" ? "" : name}${name == "~" ? id : `[${id}]`}`
                }))));

            this.Record = records;
        });
    };

    public static Record: Array<{
        id: string;
        name: string;
        page: string;
        isFree: boolean;

        cheats: Array<string>;
        anticheats: Array<string>;
        status: "safe" | "warn" | "risk";
    }> = [];
};


const blacklistedAddress = db.collection("blacklistedAddress");
export const addThisUserToBanlist = (ip: string, userAgent: UserAgent, user: string, reason: string, image: string) => new Promise(async resolve => {
    if (await blacklistedAddress.findOne({ $or: [{ $or: [{ ip: "*" }, { ip }] }, { $or: [{ userAgent: "*" }, { userAgent: userAgent.encoded }] }] }))
        resolve({ status: false, err: "Your device is banned." });

    else {
        await blacklistedAddress.insertOne({ ip, user, reason, userAgent: userAgent.encoded, device: userAgent.readable, time: `${(new Date()).toDateString()} ${(new Date()).toTimeString()}` });

        try {
            const data = new FormData();
            data.append('file', new Blob([Uint8Array.from(atob(image), c => c.charCodeAt(0))], { type: 'image/png' }), "image.png");

            let content = (user ? `## USERNAME${"```"}${user}${"```"}\n` : "")
                .concat(`## REASON FOR BAN${"```"}${reason}${"```"}\n\n\n`)

                .concat(`### IP${"```"}${ip}${"```"}\n`)
                .concat(`### DEVICE INFO${"```"}${userAgent.readable}${"```"}\n`);

            data.append('content', content.concat(`|| @here ||`));
            await fetch(Env.discord_url, { body: data, method: 'POST', });
        } catch (err) { console.log(err); };

        resolve({ status: true });
    };
});
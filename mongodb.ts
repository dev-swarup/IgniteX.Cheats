import { Env, UserAgent } from "./utils.ts";

const MongoClient = (await (new ((await import("mongodb")).MongoClient)(Env.MongoDBUrl))
    .connect()).addListener("close", async () => setTimeout(async () => await MongoClient.connect(), 1000)), db = MongoClient.db("db");

export class User {
    constructor() { };
    public static userList = db.collection("UserList");
    private static userTable = db.collection("UserTable");

    static login(user: string, pass: string, seller: string, userAgent: UserAgent): Promise<{
        status: true, data: {
            codes: Array<{
                id: string;
                page: string;
                status: boolean;
                data: Array<[["*" | number, "*" | number], string, string | [number, number]]>;
            }>, expiry: number | "LIFETIME", seller: string
        }
    } | { status: false, err: string }> {
        return new Promise(async resolve => {
            try {
                const device = userAgent.Encoded, client = await this.userTable.findOne({ user, seller }); if (client)
                    if (client.pass === pass)
                        if (["*", "-", device].includes(client.device)) {
                            const currentTime = (new Date()).getTime();
                            const activeLicenses = client.license.map(([page, name, time]) => {
                                if (time.startsWith("LIFETIME")) {
                                    let [t, o] = time.split("|");

                                    o = Number(o.replace("OB", ""));
                                    return Env.CurrentOB == o ? { status: true, page, name, time: "LIFETIME" } : { status: false };
                                } else
                                    return currentTime <= time ? { status: true, page, name, time } : { status: false };
                            }).filter(e => e.status).sort((i, e) => e.time === "LIFETIME" ? i.time === "LIFETIME" ? 1 : 1 : e.time - i.time);

                            const licenses = {};
                            activeLicenses.forEach(({ page, name }) => {
                                if (!(page in licenses))
                                    licenses[page] = [];

                                name.forEach((name: string) => licenses[page].push(name));
                            });

                            const codes = Codes.Codes.filter(({ name, page }) => {
                                if ("ALL" in licenses) {
                                    /// @ts-expect-error
                                    return (licenses["ALL"].includes("ALL") || licenses[page].includes(name));
                                };

                                if (page in licenses)
                                    return (licenses[page].includes("ALL") || licenses[page].includes(name));
                                else
                                    return false;
                            }).map(({ id, page, data, status }) => ({ id, page, status, data }));

                            if (codes.length == 0)
                                return resolve({ status: false, err: "All our codes are patched. Try again later." });

                            if (activeLicenses.length == 0)
                                return resolve({ status: false, err: "Subscription expired. Renew to continue." });

                            const expiry = activeLicenses.at(0).time;
                            if (client.device === "-")
                                try {
                                    await this.userTable.findOneAndReplace({ _id: client._id }, { ...client, device });
                                } catch (err) { return resolve({ status: false, err: "Device authentication failed. Try again or contact seller." }); };

                            return resolve({ status: true, data: { codes, expiry, seller } });
                        } else
                            return resolve({ status: false, err: "Unmatched device Id. Contact seller to reset access." });
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
        if (await this.userList.findOne({ ip, userAgent: userAgent.Encoded, type: "WhiteListed" }))
            resolve({ status: true, whitelisted: true });

        else
            if (await this.userList.findOne({ ip, userAgent: userAgent.Encoded, type: "BlackListed" }))
                resolve({ status: false, err: "Your device is banned." });

            else
                resolve({ status: true, whitelisted: false });
    });
};

export class Codes {
    constructor() { };
    private static cheats = db.collection("Codes");

    public static init(): Promise<void> {
        return new Promise(async () => {
            const result: Array<any> = (await this.cheats.find({}).map(({ _id: id, status, data }) => {
                /// @ts-expect-error
                let [page, name] = (id as string).split(".");

                let vName: string | null = null; if (name.includes("[") && name.endsWith("]")) {
                    const [e, i] = name.split("[");

                    name = e;
                    vName = i.slice(0, i.length - 1);
                };

                return { id: `${name}${vName ? `[${vName}]` : ``}`, name, page, status, data: data.filter(({ length }) => length > 0) };
            }).toArray()).filter(({ data }) => data.length > 0);

            this.Codes = result;
        });
    };

    public static Codes: Array<{
        id: string;
        name: string;
        page: string;
        status: boolean;
        data: Array<[["*" | number, "*" | number], string, string | [number, number]]>;
    }> = [];
};

export const addThisUserToBanlist = (ip: string, userAgent: UserAgent, user: string, reason: string, image: string) => new Promise(async resolve => {
    if (await User.userList.findOne({ ip, userAgent: userAgent.Encoded, type: "BlackListed" }))
        resolve({ status: false, err: "Your device is banned." });

    else {
        await User.userList.insertOne({ ip, user, reason, userAgent: userAgent.Encoded, device: userAgent.Readable, time: `${(new Date()).toDateString()} ${(new Date()).toTimeString()}`, type: "BlackListed" });

        try {
            const data = new FormData();
            data.append('file', new Blob([Uint8Array.from(atob(image), c => c.charCodeAt(0))], { type: 'image/png' }), "image.png");

            let content = (user ? `## USERNAME${"```"}${user}${"```"}\n` : "")
                .concat(`## REASON FOR BAN${"```"}${reason}${"```"}\n\n\n`)

                .concat(`### IP${"```"}${ip}${"```"}\n`)
                .concat(`### DEVICE INFO${"```"}${userAgent.Readable}${"```"}\n`);

            data.append('content', content.concat(`|| @here ||`));
            await fetch(Env.DiscordUrl, { body: data, method: 'POST', });
        } catch (err) { console.log(err); };

        resolve({ status: true });
    };
});
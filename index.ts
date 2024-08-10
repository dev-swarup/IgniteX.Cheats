import fs from "fs";
import path from "path";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";

let ElysiaTokens = {}; const app = new Elysia({ precompile: true }).onError(({ set, code, error }) => {
    console.log(error);

    set.status = "OK";
    return { status: false, err: code == "NOT_FOUND" ? "Invalid path called" : "Internal Server Error. Try again later." };
});

app.use(rateLimit({
    max: 50, headers: false, duration: 5 * 60 * 1000, errorResponse: new Response(JSON.stringify({ status: false, err: "You are sending too much requests in very little time, Hold on. IP Address blocked for 5 min." }), {
        status: 200,
        statusText: "OK"
    })
}));


import { MongoClient } from "mongodb";
const MongoDB = await (new MongoClient(process.env.MONGODB_URL as string)).connect(); MongoDB.addListener("close", async () => {
    setTimeout(async () => await MongoDB.connect(), 1000);
});


const { version } = require("./package.json"),
    cheats = MongoDB.db("MisteroCheats").collection("cheats"),
    clients = MongoDB.db("MisteroCheats").collection("clients");


app
    .get('/api/status', async ({ set, query: data, headers }) => {
        set.status = "OK";
        if (data.auth && 'x-user-agent' in headers && 'x-version' in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 1:
                case -1:
                default:
                    return { status: false, err: "This Version is outdated. Download the latest version." };

                case 0:
                    if (data.auth in ElysiaTokens) {
                        const session = ElysiaTokens[data.auth];
                        if (headers['x-user-agent'] === session.device)
                            return { status: true };
                        else
                            return { status: false, err: "This device is not registered. Ask the Owner for a Device Reset." };
                    } else
                        return { status: false, err: "Your session has expired. Re-Login to the Panel." };
            }
        else
            return { status: true };
    })

    .get("/api/login", async ({ set, query: data, headers, request }) => {
        set.status = 'OK';
        if ("user" in data && "pass" in data)
            if ('x-user-agent' in headers && 'x-version' in headers)
                switch (Bun.semver.order(headers['x-version'] as string, version)) {
                    case 1:
                    case -1:
                    default:
                        return { status: false, err: "This Version is outdated. Download the latest version." };

                    case 0:
                        try {
                            const client = await clients.findOne({ user: data.user }); if (client)
                                if (data.pass === client.pass)
                                    if (client.device === '-' || client.device === '*' || client.device === headers['x-user-agent']) {
                                        const currentTime = (new Date()).getTime();
                                        const activeLicenses = client.license.map(([page, name, time]) => {
                                            if (time === "LIFETIME")
                                                return { status: true, page, name, time: "LIFETIME" };

                                            else
                                                return currentTime < time ? { status: true, page, name, time } : { status: false };
                                        }).filter(e => e.status).sort((i, e) => e.time === "LIFETIME" ? i.time === "LIFETIME" ? 1 : 1 : e.time - i.time);

                                        if (client.device === '-') {
                                            try {
                                                await clients.findOneAndReplace({ _id: client._id }, { ...client, device: headers['x-user-agent'] });
                                            } catch {
                                                return { status: false, err: "Failed to register your device. Try again later." };
                                            };
                                        };

                                        if (activeLicenses.length === 0)
                                            return { status: false, err: "Subscription's Expired. Purchase new ones." };


                                        const token = Buffer.from(`${headers['x-user-agent']?.slice(0, 18)}+${client.user}+${currentTime}`).toString("base64url");

                                        ElysiaTokens[token] = activeLicenses;
                                        setTimeout(async () => { delete ElysiaTokens[token]; }, 3 * 60 * 60 * 1000);

                                        return { status: true, data: { token, license: activeLicenses.map(e => { return { page: e.page, name: e.name, time: e.time } }), expiry: activeLicenses.at(0).time } };
                                    } else
                                        return { status: false, err: "This device is not registered. Ask the Owner for a Device Reset." };
                                else
                                    return { status: false, err: "Incorrect password. Please check the username and password or Try again later." };
                            else
                                return { status: false, err: "Username is not registered. Ask the Owner to register your username." };
                        } catch (err) {
                            console.log(err);
                            return { status: false, err: "Sorry, our servers are unable to process your request. Try again later." };
                        };
                }
            else
                return { status: false, err: "Invalid Request. Ensure you are using correct version." };
        else
            return { status: false, err: "Enter your username and password." };
    })

    .get('/api/cheat/code/:token/:code', async ({ set, params }) => {
        set.status = 'OK';
        if ("token" in params || "code" in params) {
            if (params.token in ElysiaTokens) {
                const cheat = await cheats.findOne({ name: params.code }); if (cheat) {
                    const licenses = ElysiaTokens[params.token];

                    let license = licenses.find(e => e.name === "ALL" || e.name === params.code); if (license)
                        return { status: true, data: { status: cheat.status, data: cheat.data } };
                    else
                        return { status: false, err: "This cheat is not in your subscription. Purchase it first." };
                } else
                    return { status: false, err: "This cheat is not yet ready. Wait for next update." };
            } else
                return { status: false, err: "Your session has expired. Re-Login to the Panel." };
        } else
            return { status: false, err: "Invalid Request. Ensure you are using correct version." };
    });


app
    .get('/api/cheat/menu/:token/:code', async ({ set, params }) => {
        if ("token" in params || "code" in params) {
            if (params.token in ElysiaTokens) {
                const __path = path.join(__dirname, 'Assets', 'LocationMenu', `${params.code}.dll`); if (fs.existsSync(__path))
                    return Bun.file(__path);
                else {
                    set.status = 'Forbidden';
                    return { status: false, err: "This Location Chams is not yet ready. Wait for next update." };
                };
            } else {
                set.status = 'Forbidden';
                return { status: false, err: "Your session has expired. Re-Login to the Panel." };
            };
        } else {
            set.status = 'Forbidden';
            return { status: false, err: "Invalid Request. Ensure you are using correct version." };
        };
    });

app.listen({ reusePort: true, hostname: '0.0.0.0', port: process.env.PORT }, () => console.log(`[${process.env.PORT}] Listening ...`));
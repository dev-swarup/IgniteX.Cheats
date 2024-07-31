import fs from "fs";
import path from "path";


import { Elysia } from "elysia";
let sessions = {}; const app = new Elysia({ precompile: true }).get("/CascadiaCode.TTF", async () => Bun.file(path.join(__dirname, 'Assets', 'CascadiaCode.TTF'))).onError(({ set }) => {
    set.status = "OK";
    return { status: false, message: "Internal Server Error. Try again later." };
});

import { rateLimit } from "elysia-rate-limit"; app.use(rateLimit({
    max: 50, duration: 5 * 60 * 1000, errorResponse: new Response(JSON.stringify({ status: false, message: "You are sending too much requests in very little time, Hold on. IP Address blocked for 5 min." }), {
        status: 200,
        statusText: "OK"
    })
}));


import { MongoClient } from "mongodb";
const MongoDB = await (new MongoClient(process.env.MONGODB_URL as string)).connect(); MongoDB.addListener("close", async () => {
    setTimeout(async () => await MongoDB.connect(), 1000);
});


const { version } = require("./package.json"), database = MongoDB.db("MisteroCheats").collection("clients");
app.get("/api/login", async ({ set, query: data, headers, request }) => {
    if ("user" in data && "pass" in data) {
        if ('user-agent' in headers && 'version' in headers) {
            switch (Bun.semver.order(headers.version as string, version)) {
                case 1:
                case -1:
                default:
                    set.status = 'OK';
                    return { status: false, msg: "Newer Version is here. Download the latest version." };

                case 0:
                    try {
                        const user = await database.findOne({ user: data.user });
                        if (user) {
                            if (data.pass === user.pass) {
                                if (user.device === '-' || user.device === '*' || user.device === headers['user-agent']) {
                                    const currentTime = (new Date()).getTime();
                                    const activeLicenses = user.license.map(([page, name, time]) => {
                                        if (time === "LIFETIME")
                                            return { status: true, page, name, time: "LIFETIME" };

                                        else
                                            return currentTime < time ? { status: true, page, name, time } : { status: false };
                                    }).filter(e => e.status).sort((i, e) => e.time === "LIFETIME" ? i.time === "LIFETIME" ? 1 : 1 : e.time - i.time);

                                    if (activeLicenses.length > 0) {
                                        if (data.device === '-') {
                                            try {
                                                await database.findOneAndReplace({ _id: user._id }, { ...data, device: headers['user-agent'] });
                                            } catch { };
                                        };
                                        const token = Buffer.from(`${data.device}+${data.user}`).toString("base64url");

                                        sessions[token] = activeLicenses;
                                        setTimeout(async () => { delete sessions[token]; }, 3 * 60 * 60 * 1000);

                                        set.status = 'OK';
                                        return { status: true, data: { token, license: activeLicenses.map(e => { return { page: e.page, name: e.name, time: e.time } }), expiry: activeLicenses.at(0).time } };
                                    } else {
                                        set.status = 'OK';
                                        return { status: false, msg: "You have no cheats left in your subscription to access the application." };
                                    };
                                } else {
                                    set.status = 'OK';
                                    return { status: false, msg: "This device is not registed. Please ask the developer for Device Reset." };
                                };
                            } else {
                                set.status = 'OK';
                                return { status: false, msg: "Password is incorrect. Please check the username and password or Try again later." };
                            };
                        } else {
                            set.status = 'OK';
                            return { status: false, msg: "Username is not registered. Please ask the developer to register your username." };
                        };
                    } catch (err) {
                        console.log(err);

                        set.status = 'OK';
                        return { status: false, msg: "Sorry, our servers are unable to process your request. Try again later." };
                    };
            };
        } else {
            set.status = 'OK';
            return { status: false, msg: "The device you are using is unknown to us. Are you trying you tamper with the program?" };
        };
    } else {
        set.status = 'OK';
        return { status: false, msg: "Enter your username and password." };
    };
});


let cheat_codes: Record<string, [boolean, Array<[string, string]>]> = JSON.parse(fs.readFileSync(path.join(__dirname, 'Assets', 'CheatCodes.json'), 'utf8'));
fs.watchFile(path.join(__dirname, 'CheatCodes.json'), { interval: 5000 }, async () => cheat_codes = JSON.parse(fs.readFileSync(path.join(__dirname, 'Assets', 'CheatCodes.json'), 'utf8')));

app
    .get('/api/cheat/menu/:token/:code', async ({ set, params }) => {
        if ("token" in params || "code" in params) {
            if (params.token in sessions)
                return Bun.file(path.join(__dirname, 'Assets', 'LocationMenu', `${params.code}.dll`));
            else {
                set.status = 'Forbidden';
                return { status: false, msg: "Your session has expired. Please restart the app." };
            };
        } else {
            set.status = 'Forbidden';
            return { status: false, msg: "Invalied request. Are you trying you tamper with the program?" };
        };
    })
    .get('/api/cheat/code/:token/:code', async ({ set, params }) => {
        if ("token" in params || "code" in params) {
            if (params.token in sessions) {
                if (params.code in cheat_codes) {
                    const licenses = sessions[params.token];

                    let license = licenses.find(e => e.name === "ALL" || e.name === params.code); if (license) {
                        set.status = "OK";
                        return { status: true, data: cheat_codes[params.code] };
                    }

                    else {
                        set.status = 'OK';
                        return { status: false, msg: "This feature is not in your subscription. Purchase it first." };
                    };
                } else {
                    set.status = 'OK';
                    return { status: false, msg: "This feature is not yet complete. Ask the developer for more details." };
                };
            } else {
                set.status = 'OK';
                return { status: false, msg: "Your session has expired. Please restart the program." };
            };
        } else {
            set.status = 'OK';
            return { status: false, msg: "Invalied request. Are you trying you tamper with the program?" };
        };
    });

app.listen({ reusePort: true, hostname: '0.0.0.0', port: process.env.PORT }, () => console.log(`[${process.pid}] Listening ...`));
import fs from "fs";
import path from "path";
import { Elysia } from "elysia";
import { version } from "./package.json";
import { rateLimit } from "elysia-rate-limit";

const app = new Elysia({ precompile: true }).onError(({ set, code, error }) => {
    set.status = "OK"; if (code == "NOT_FOUND")
        return { status: false, err: "You reached a path, which doesn't exist. Ensure you are using correct application and version." };

    else {
        console.log(error);
        return { status: false, err: "Internal Server Error. Try again later." };
    };
});

import { MongoClient } from "mongodb";
const MongoDB = await (new MongoClient(process.env.MONGODB_URL as string)).connect(), db = MongoDB.db("MisteroCheats"); MongoDB.addListener("close", async () =>
    setTimeout(async () => await MongoDB.connect(), 1000));

const cheats = db.collection("cheats"), clients = db.collection("clients"), sessions = db.collection("sessions");
app.use(rateLimit({ max: 50, headers: false, duration: 50000, errorResponse: Response.json({ status: false, err: "You have reached the max request limit, Try again after 10 min." }) })).group("/api", app => app.onBeforeHandle(async req => {
    if ("x-version" in req.headers && "x-user-agent" in req.headers)
        switch (Bun.semver.order(req.headers['x-version'] as string, version)) {
            case 1:
            case -1:
                return { status: false, err: "This Version is outdated. Use the latest version." };

            case 0:
                if ("x-token" in req.headers)
                    try {
                        /// @ts-expect-error
                        req.session = await sessions.findOne({ token: req.headers["x-token"] }); if (session) {

                            /// @ts-expect-error
                            return req.headers['x-user-agent'] === req.session.device ?
                                null : { status: false, err: "This device is not registered. Ask the Owner for a Device Reset." };
                        } else
                            return { status: false, err: "Your session has expired. Try restarting the Panel." };
                    } catch (err) { console.log(err); return Response.json({ status: false, err: "Error while checking the current session. Try restarting the Panel." }); }
                else
                    return null;
        }
    else
        return Response.json({ status: false, err: "Invalid Request. Ensure you are using correct application and version." });
}));

app
    .get('/api/status', async () => ({ status: true }))
    .get("/api/account/login", async ({ query: data, headers }) => {
        if ("user" in data && "pass" in data)
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

                            if (client.device === '-')
                                try {
                                    await clients.findOneAndReplace({ _id: client._id }, { ...client, device: headers['x-user-agent'] });
                                } catch (err) {
                                    console.log(err);
                                    return { status: false, err: "Failed to register your device. Try again later." };
                                }

                            if (activeLicenses.length === 0)
                                return { status: false, err: "Subscription's Expired. Get the new ones." };

                            const token = Buffer.from(`${headers['x-user-agent']?.slice(0, 18)}+${client.user}+${currentTime}`).toString("base64url");

                            try {
                                await sessions.insertOne({ token, device: client.device, activeLicenses, createdAt: { expires: "8h" } });
                                return { status: true, data: { token, license: activeLicenses.map(e => { return { page: e.page, name: e.name, time: e.time } }), expiry: activeLicenses.at(0).time } };
                            } catch (err) {
                                console.log(err);
                                return { status: false, err: "Error while creating a session. Try again later." };
                            };
                        } else
                            return { status: false, err: "This device is not registered. Ask the Owner for a Device Reset." };
                    else
                        return { status: false, err: "Incorrect password. Check your username and password." };
                else
                    return { status: false, err: "Username is not registered. Ask the Owner to register your username." };
            } catch (err) {
                console.log(err);
                return { status: false, err: "Error while searching your username. Try again later." };
            }
        else
            return { status: false, err: "Enter your username and password" };
    })

    .get('/api/cheat/code/:code', async req => {
        if ("session" in req) {
            const cheat = await cheats.findOne({ name: req.params.code }); if (cheat) {
                /// @ts-expect-error
                let license = req.session.activeLicenses.find(e => e.name === "ALL" || e.name === params.code); if (license)
                    return { status: true, data: { status: cheat.status, data: cheat.data } };
                else
                    return { status: false, err: "This cheat is not in your subscription. Purchase it first." };
            } else
                return { status: false, err: "This cheat is not yet ready. Wait for next update." };

        } else
            return { status: false, err: "Your session has expired. Try restarting the Panel." };
    });


app
    .get('/api/cheat/menu/:code', async ({ set, params }) => {
        const menu = path.join(__dirname, 'Assets', 'LocationMenu', `${params.code}.dll`); if (fs.existsSync(menu))
            return Bun.file(menu);
        else {
            set.status = 'Forbidden';
            return { status: false, err: "This location is not yet ready. Wait for next update." };
        };
    });

app.listen({ reusePort: true, hostname: '0.0.0.0', port: process.env.PORT }, () => console.log(`[${process.env.PORT}] Listening ...`));
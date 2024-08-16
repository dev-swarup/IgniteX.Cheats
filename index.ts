import fs from "fs";
import path from "path";
import { Elysia } from "elysia";
import { version } from "./package.json";
import { rateLimit } from "elysia-rate-limit";

const app = new Elysia({ precompile: true }).onError(({ set, code, error }) => {
    set.status = "OK";

    if (code !== "NOT_FOUND") {
        console.log(error);
        return { status: false, err: "🚨 Uh-oh! Something went wrong on our end. Internal Server Error. Please try again later. 🔧" };

    } else
        return { status: false, err: "❗ Oops! The path you requested doesn't exist on the server. Please check the URL and try again. 🛠️" };
});

import { MongoClient } from "mongodb";
const MongoDB = await (new MongoClient(process.env.MONGODB_URL as string)).connect(), db = MongoDB.db("MisteroCheats"); MongoDB.addListener("close", async () =>
    setTimeout(async () => await MongoDB.connect(), 1000));

const cheats = db.collection("cheats"), clients = db.collection("clients"), sessions = db.collection("sessions"), sellers = db.collection("sellers");
app.use(rateLimit({ max: 50, headers: false, duration: 50000, errorResponse: Response.json({ status: false, err: "⏳ Too many requests in a short time. You've been temporarily banned for 10 minutes. 🚫" }) })).group("/api", app => app
    .get('/status', async ({ headers }) => {
        if ("x-version" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 0:
                    return { status: true };

                case 1:
                case -1:
                    return { status: false, err: "⚠️ Hey! You're using an older version. Please update to the latest version for the best experience. 📲" };
            }
        else
            return { status: true };
    })

    .get("/client/login", async ({ query: data, headers }) => {
        if ("x-seller" in headers && "x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 1:
                case -1:
                    return Response.json({ status: false, err: "⚠️ Hey! You're using an older version. Please update to the latest version for the best experience. 📲" });

                case 0:
                    if ("user" in data && "pass" in data)
                        try {
                            const client = await clients.findOne({ user: data.user, seller: headers["x-seller"] }); if (client)
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
                                                return { status: false, err: "🔒 Device registration failed. Please try again or contact the owner for assistance. 🔄" };
                                            }

                                        if (activeLicenses.length === 0)
                                            return { status: false, err: "⏰ Your subscription has expired. Please renew to continue using the service. 📅" };

                                        const token = Buffer.from(`${headers['x-user-agent']?.slice(0, 30)}+${client.user}+${currentTime}`).toString("base64url");

                                        try {
                                            await sessions.insertOne({ token, user: client.user, seller: headers["x-seller"], device: headers['x-user-agent'], activeLicenses });
                                            return Response.json({ status: true, data: { token, license: activeLicenses.map(e => { return { page: e.page, name: e.name, time: e.time } }), expiry: activeLicenses.at(0).time } });
                                        } catch (err) {
                                            console.log(err);
                                            return Response.json({ status: false, err: "⚠️ Unable to create session. Please try again. 🔄" });
                                        };
                                    } else
                                        return Response.json({ status: false, err: "🔒 This device isn't registered. Please contact the owner to reset your device access. 🔄" });
                                else
                                    return Response.json({ status: false, err: "🔒 Incorrect password. Please try again. 🔄" });
                            else
                                return Response.json({ status: false, err: "🔍 Oops! That username isn't registered. Ask the owner to add you. 📂" });
                        } catch (err) {
                            console.log(err);
                            return Response.json({ status: false, err: "⚠️ There was an error while searching for the username. Please try again later. 🔄" });
                        }
                    else
                        return Response.json({ status: false, err: "⚠️ Please enter both username and password to proceed. 📝" });
            }
        else
            return Response.json({ status: false, err: "🔍 Hmm, something's off with your request. Please ensure you're using the correct version and try again. 🛠️" });
    })

    .get("/seller/status", async ({ headers }) => {
        if ("x-seller" in headers && "x-seller-pass" in headers && "x-user-agent" in headers)
            try {
                const seller = await sellers.findOne({ name: headers["x-seller"] }); if (seller) {
                    if (seller.pass === headers["x-seller-pass"])
                        if (seller.device === headers["x-user-agent"])
                            return Response.json({ status: true });

                        else
                            return Response.json({ status: false, err: "🔒 This device isn't registered. Please contact the owner to reset your device access. 🔄" });
                    else
                        return Response.json({ status: false, err: "🔒 Incorrect password. Please try again. 🔄" });
                } else
                    return Response.json({ status: false, err: "🔍 Seller not found. Please check the username or contact support for assistance. 📂" });
            } catch (err) {
                console.log(err);
                return Response.json({ status: false, err: "⚠️ There was an error while searching for the username. Please try again later. 🔄" });
            }
        else
            return Response.json({ status: false, err: "🔍 Hmm, something's off with your request. Please ensure you're using the correct version and try again. 🛠️" });
    })

    .get("/seller/clients", async ({ headers }) => {
        if ("x-seller" in headers && "x-seller-pass" in headers && "x-user-agent" in headers)
            try {
                const seller = await sellers.findOne({ name: headers["x-seller"] }); if (seller) {
                    if (seller.pass === headers["x-seller-pass"])
                        if (seller.device === headers["x-user-agent"])
                            try {
                                const allClients = clients.find({ ...(seller.isMaster ? {} : { seller: headers["x-seller"] }) });
                                return Response.json({ status: true, data: await allClients.map(client => ({ user: client.user, license: client.license, seller: client.seller })).toArray() });
                            } catch (err) {
                                console.log(err);
                                return Response.json({ status: false, err: "⚠️ Failed to retrieve clients. Please try again or contact support. 🔄" });
                            }

                        else
                            return Response.json({ status: false, err: "🔒 This device isn't registered. Please contact the owner to reset your device access. 🔄" });
                    else
                        return Response.json({ status: false, err: "🔒 Incorrect password. Please try again. 🔄" });
                } else
                    return Response.json({ status: false, err: "🔍 Seller not found. Please check the username or contact support for assistance. 📂" });
            } catch (err) {
                console.log(err);
                return Response.json({ status: false, err: "⚠️ There was an error while searching for the username. Please try again later. 🔄" });
            }
        else
            return Response.json({ status: false, err: "🔍 Hmm, something's off with your request. Please ensure you're using the correct version and try again. 🛠️" });
    })

    .post("/client/register", async ({ query: data, headers }) => {
        if ("x-seller" in headers && "x-seller-pass" in headers && "x-user-agent" in headers)
            try {
                const seller = await sellers.findOne({ name: headers["x-seller"] }); if (seller) {
                    if (seller.pass === headers["x-seller-pass"])
                        if (seller.device === headers["x-user-agent"])
                            if ("user" in data && "pass" in data)
                                if (!(await clients.findOne({ user: data.user, seller: headers["x-seller"] }))) {
                                    try {
                                        await clients
                                            .insertOne({ user: data.user, pass: data.pass, device: "-", seller: headers["x-seller"], license: [] });

                                        return Response.json({ status: true });
                                    } catch (err) {
                                        console.log(err);
                                        return Response.json({ status: false, err: "⚠️ Failed to register username and password. Please try again or contact support. 🔄" });
                                    }
                                } else
                                    return Response.json({ status: false, err: "⚠️ Username already exists. Please choose a different username. 🔄" });
                            else
                                return Response.json({ status: false, err: "⚠️ Please enter both username and password to proceed. 📝" });
                        else
                            return Response.json({ status: false, err: "🔒 This device isn't registered. Please contact the owner to reset your device access. 🔄" });
                    else
                        return Response.json({ status: false, err: "🔒 Incorrect password. Please try again. 🔄" });
                } else
                    return Response.json({ status: false, err: "🔍 Seller not found. Please check the username or contact support for assistance. 📂" });
            } catch (err) {
                console.log(err);
                return Response.json({ status: false, err: "⚠️ There was an error while searching for the username. Please try again later. 🔄" });
            }
        else
            return Response.json({ status: false, err: "🔍 Hmm, something's off with your request. Please ensure you're using the correct version and try again. 🛠️" });
    })

    .post("/client/reset/device", async ({ query: data, headers }) => {
        if ("x-seller" in headers && "x-seller-pass" in headers && "x-user-agent" in headers)
            try {
                const seller = await sellers.findOne({ name: headers["x-seller"] }); if (seller) {
                    if (seller.pass === headers["x-seller-pass"])
                        if (seller.device === headers["x-user-agent"])
                            if ("user" in data) {
                                const client = await clients.findOne({ user: data.user, seller: headers["x-seller"] });

                                if (client)
                                    try {
                                        await clients
                                            .findOneAndReplace({ user: data.user, seller: headers["x-seller"] }, { device: "-", ...client });

                                        return Response.json({ status: true });
                                    } catch (err) {
                                        console.log(err);
                                        return Response.json({ status: false, err: "⚠️ Failed to reset the device. Please try again or contact support. 🔄" });
                                    }
                                else
                                    return Response.json({ status: false, err: "🔍 Oops! That username isn't registered. First add this user. 📂" });
                            } else
                                return Response.json({ status: false, err: "⚠️ Please enter username to proceed. 📝" });
                        else
                            return Response.json({ status: false, err: "🔒 This device isn't registered. Please contact the owner to reset your device access. 🔄" });
                    else
                        return Response.json({ status: false, err: "🔒 Incorrect password. Please try again. 🔄" });
                } else
                    return Response.json({ status: false, err: "🔍 Seller not found. Please check the username or contact support for assistance. 📂" });
            } catch (err) {
                console.log(err);
                return Response.json({ status: false, err: "⚠️ There was an error while searching for the username. Please try again later. 🔄" });
            }
        else
            return Response.json({ status: false, err: "🔍 Hmm, something's off with your request. Please ensure you're using the correct version and try again. 🛠️" });
    })

    .post("/client/reset/password", async ({ query: data, headers }) => {
        if ("x-seller" in headers && "x-seller-pass" in headers && "x-user-agent" in headers)
            try {
                const seller = await sellers.findOne({ name: headers["x-seller"] }); if (seller) {
                    if (seller.pass === headers["x-seller-pass"])
                        if (seller.device === headers["x-user-agent"])
                            if ("user" in data && "pass" in data) {
                                const client = await clients.findOne({ user: data.user, seller: headers["x-seller"] });

                                if (client)
                                    try {
                                        await clients
                                            .findOneAndReplace({ user: data.user, seller: headers["x-seller"] }, { user: data.user, pass: data.pass, ...client });

                                        return Response.json({ status: true });
                                    } catch (err) {
                                        console.log(err);
                                        return Response.json({ status: false, err: "⚠️ Failed to reset the password. Please try again or contact support. 🔄" });
                                    }
                                else
                                    return Response.json({ status: false, err: "🔍 Oops! That username isn't registered. First add this user. 📂" });
                            } else
                                return Response.json({ status: false, err: "⚠️ Please enter both username and password to proceed. 📝" });
                        else
                            return Response.json({ status: false, err: "🔒 This device isn't registered. Please contact the owner to reset your device access. 🔄" });
                    else
                        return Response.json({ status: false, err: "🔒 Incorrect password. Please try again. 🔄" });
                } else
                    return Response.json({ status: false, err: "🔍 Seller not found. Please check the username or contact support for assistance. 📂" });
            } catch (err) {
                console.log(err);
                return Response.json({ status: false, err: "⚠️ There was an error while searching for the username. Please try again later. 🔄" });
            }
        else
            return Response.json({ status: false, err: "🔍 Hmm, something's off with your request. Please ensure you're using the correct version and try again. 🛠️" });
    })

    .post("/client/update/license", async ({ query: data, headers }) => {
        if ("x-seller" in headers && "x-seller-pass" in headers && "x-user-agent" in headers)
            try {
                const seller = await sellers.findOne({ name: headers["x-seller"] }); if (seller) {
                    if (seller.pass === headers["x-seller-pass"])
                        if (seller.device === headers["x-user-agent"])
                            if ("user" in data && "license" in data) {
                                const client = await clients.findOne({ user: data.user, seller: headers["x-seller"] });

                                if (client)
                                    try {
                                        await clients
                                            .findOneAndReplace({ user: data.user, seller: headers["x-seller"] }, { ...client, license: JSON.parse(data["license"] as string) });

                                        return Response.json({ status: true });
                                    } catch (err) {
                                        console.log(err);
                                        return Response.json({ status: false, err: "⚠️ Failed to update the license. Please try again or contact support. 🔄" });
                                    }
                                else
                                    return Response.json({ status: false, err: "🔍 Oops! That username isn't registered. First add this user. 📂" });
                            } else
                                return Response.json({ status: false, err: "⚠️ Please enter both username and license to proceed. 📝" });
                        else
                            return Response.json({ status: false, err: "🔒 This device isn't registered. Please contact the owner to reset your device access. 🔄" });
                    else
                        return Response.json({ status: false, err: "🔒 Incorrect password. Please try again. 🔄" });
                } else
                    return Response.json({ status: false, err: "🔍 Seller not found. Please check the username or contact support for assistance. 📂" });
            } catch (err) {
                console.log(err);
                return Response.json({ status: false, err: "⚠️ There was an error while searching for the username. Please try again later. 🔄" });
            }
        else
            return Response.json({ status: false, err: "🔍 Hmm, something's off with your request. Please ensure you're using the correct version and try again. 🛠️" });
    })

    .post("/client/update/license/addTime", async ({ body: data, headers }) => {
        if ("x-seller" in headers && "x-seller-pass" in headers && "x-user-agent" in headers)
            try {
                const seller = await sellers.findOne({ name: headers["x-seller"] }); if (seller) {
                    if (seller.pass === headers["x-seller-pass"])
                        if (seller.device === headers["x-user-agent"])
                            /// @ts-expect-error
                            if ("clients" in data && "addTime" in data && "cheat" in data)
                                return Response.json({ status: false, err: "🔍 Not implemented yet. 📂" });

                            else
                                return Response.json({ status: false, err: "⚠️ Please selects clients to proceed. 📝" });
                        else
                            return Response.json({ status: false, err: "🔒 This device isn't registered. Please contact the owner to reset your device access. 🔄" });
                    else
                        return Response.json({ status: false, err: "🔒 Incorrect password. Please try again. 🔄" });
                } else
                    return Response.json({ status: false, err: "🔍 Seller not found. Please check the username or contact support for assistance. 📂" });
            } catch (err) {
                console.log(err);
                return Response.json({ status: false, err: "⚠️ There was an error while searching for the username. Please try again later. 🔄" });
            }
        else
            return Response.json({ status: false, err: "🔍 Hmm, something's off with your request. Please ensure you're using the correct version and try again. 🛠️" });
    })

    .get('/cheat/code/:code', async ({ params, headers }) => {
        if ("x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 1:
                case -1:
                    return Response.json({ status: false, err: "⚠️ Hey! You're using an older version. Please update to the latest version for the best experience. 📲" });

                case 0:
                    if ("x-token" in headers)
                        try {
                            const session = await sessions.findOne({ token: headers["x-token"] }); if (session) {
                                if (session.device === '*' || session.device === headers['x-user-agent']) {
                                    const cheat = await cheats.findOne({ name: params.code }); if (cheat) {
                                        let license = session.activeLicenses.find(e => e.name === "ALL" || e.name === params.code); if (license)
                                            return Response.json({ status: true, data: { status: cheat.status, data: cheat.data } });
                                        else
                                            return Response.json({ status: false, err: "⚠️ The requested cheat is not included in your subscription. Please upgrade to access it. 🔄" });
                                    } else
                                        return Response.json({ status: false, err: "⚠️ The requested cheat code is not ready yet. Please check back later. 🔄" });
                                } else
                                    return Response.json({ status: false, err: "🔒 This device isn't registered. Please contact the owner to reset your device access. 🔄" });
                            } else
                                return Response.json({ status: false, err: "⏰ Your session has expired. Please re-login to continue. 🔄" });
                        } catch (err) { console.log(err); return Response.json({ status: false, err: "⚠️ Unable to verify session. Please try again. 🔄" }); }
                    else
                        return false;
            }
        else
            return Response.json({ status: false, err: "🔍 Hmm, something's off with your request. Please ensure you're using the correct version and try again. 🛠️" });
    })

    .get('/cheat/menu/:code', async ({ set, params, headers }) => {
        if ("x-seller" in headers && "x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 1:
                case -1:
                    return Response.json({ status: false, err: "⚠️ Hey! You're using an older version. Please update to the latest version for the best experience. 📲" });

                case 0:
                    if (fs.existsSync(path.join(__dirname, "Assets", "LocationMenu", headers["x-seller"] as string, `${params.code}.dll`)))
                        return Bun.file(path.join(__dirname, "Assets", "LocationMenu", headers["x-seller"] as string, `${params.code}.dll`));

                    else
                        if (fs.existsSync(path.join(__dirname, 'Assets', 'LocationMenu', `${params.code}.dll`)))
                            return Bun.file(path.join(__dirname, 'Assets', 'LocationMenu', `${params.code}.dll`));

                        else {
                            set.status = 'Forbidden';
                            return { status: false, err: "⚠️ Cheat Menu not ready yet. Please check back later. 🔄" };
                        };
            }
        else
            return Response.json({ status: false, err: "🔍 Hmm, something's off with your request. Please ensure you're using the correct version and try again. 🛠️" });

    }));

app
    .get('/cheat/panel/module', async () => Bun.file(path.join(__dirname, "Panel", "Mistero.rar")))
    .listen({ reusePort: true, hostname: '0.0.0.0', port: process.env.PORT }, () => console.log(`[${process.env.PORT}] Listening ...`));
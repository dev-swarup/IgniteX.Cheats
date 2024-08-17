import fs from "fs";
import path from "path";
import { Elysia } from "elysia";
import { version } from "./package.json";
import { rateLimit } from "elysia-rate-limit";
import { loginUser, registerUser, extractCheatCode } from "./mongodb.ts";

const app = new Elysia({ precompile: true }).onError(({ set, code, error }) => {
    set.status = "OK";

    if (code !== "NOT_FOUND") {
        console.log(error);
        return { status: false, err: "Uh-oh! Something went wrong on our end. Internal Server Error. Please try again later." };

    } else
        return { status: false, err: "Oops! The path you requested doesn't exist on the server. Please check the URL and try again." };
});


app.use(rateLimit({ max: 50, headers: false, duration: 50000, errorResponse: Response.json({ status: false, err: "Too many requests in a short time. You've been temporarily banned for 10 minutes." }) })).group("/api", app => app
    .get('/status', async ({ headers }) => {
        if ("x-version" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 0:
                    return { status: true };

                case 1:
                case -1:
                    return { status: false, err: "Hey! You're using an older version. Please update to the latest version for the best experience." };
            }
        else
            return { status: true };
    })


    .get("/client/login", async ({ query: data, headers }) => {
        if ("x-version" in headers && "x-seller" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 1:
                case -1:
                    return Response.json({ status: false, err: "Hey! You're using an older version. Please update to the latest version for the best experience." });

                case 0:
                    /// @ts-expect-error
                    return Response.json(await loginUser(data.user, data.pass, headers["x-seller"], headers["x-user-agent"]));
            }
        else
            return Response.json({ status: false, err: "Hmm, something's off with your request. Please ensure you're using the correct version and try again." });
    })

    .post("/client/register", async ({ query: data, headers }) => {
        if ("x-seller" in headers && "x-seller-auth" in headers)
            /// @ts-expect-error
            return Response.json(await registerUser(data.user, data.pass, headers["x-seller"], headers["x-seller-auth"], ""))
        else
            return Response.json({ status: false, err: "Hmm, something's off with your request. Please ensure you're using the correct version and try again." });
    })


    /*    .get("/seller/status", async ({ headers }) => {
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
    */
    .get('/cheat/code/:code', async ({ params, headers }) => {
        if ("x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 1:
                case -1:
                    return Response.json({ status: false, err: "Hey! You're using an older version. Please update to the latest version for the best experience." });

                case 0:
                    if ("x-token" in headers)
                        /// @ts-expect-error
                        return Response.json(await extractCheatCode(params.code, headers["x-token"], headers["x-user-agent"]));

                    else
                        return Response.json({ status: false, err: "Hmm, something's off with your request. Please ensure you're using the correct version and try again." });
            }
        else
            return Response.json({ status: false, err: "Hmm, something's off with your request. Please ensure you're using the correct version and try again." });
    })

    .get('/cheat/menu/:code', async ({ set, params, headers }) => {
        if ("x-seller" in headers && "x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 1:
                case -1:
                    return Response.json({ status: false, err: "Hey! You're using an older version. Please update to the latest version for the best experience." });

                case 0:
                    if (fs.existsSync(path.join(__dirname, "Assets", "LocationMenu", headers["x-seller"] as string, `${params.code}.dll`)))
                        return Bun.file(path.join(__dirname, "Assets", "LocationMenu", headers["x-seller"] as string, `${params.code}.dll`));

                    else
                        if (fs.existsSync(path.join(__dirname, 'Assets', 'LocationMenu', `${params.code}.dll`)))
                            return Bun.file(path.join(__dirname, 'Assets', 'LocationMenu', `${params.code}.dll`));

                        else {
                            set.status = 'Forbidden';
                            return { status: false, err: "Cheat Menu not ready yet. Please check back later." };
                        };
            }
        else
            return Response.json({ status: false, err: "Hmm, something's off with your request. Please ensure you're using the correct version and try again." });

    }));





app
    .get('/cheat/panel/module', async () => Bun.file(path.join(__dirname, "Panel", "Mistero.rar")));

app.group("/seller", app => app

    .get("/", async () => Bun.file(path.join(__dirname, "Assets", "Seller", "index.html")))
    .get("/logo.png", async () => Bun.file(path.join(__dirname, "Assets", "Seller", "logo.png")))
    .get("/static/main.css", async () => Bun.file(path.join(__dirname, "Assets", "Seller", "main.css")))
    .get("/static/js/jQuery.js", async () => Bun.file(path.join(__dirname, "Assets", "Seller", "js", "jQuery.js")))
    .get("/static/CascadiaCode.TTF", async () => Bun.file(path.join(__dirname, "Assets", "Seller", "CascadiaCode.TTF")))
    .get("/static/js/jQuery.Main.js", async () => Bun.file(path.join(__dirname, "Assets", "Seller", "js", "jQuery.Main.js"))));

app
    .listen({ reusePort: true, hostname: '0.0.0.0', port: process.env.PORT }, () => console.log(`[${process.env.PORT}] Listening ...`));
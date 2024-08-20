import fs from "fs";
import path from "path";
import { Elysia } from "elysia";
import { version } from "./package.json";

import { ip } from "elysia-ip";
import { rateLimit } from "elysia-rate-limit";
import { db, status, addToBanlist, loginUser, registerUser, extractCheatCode } from "./mongodb.ts";

const app = new Elysia({ precompile: true }).onError(({ set, code, error }) => {
    set.status = "OK";

    if (code !== "NOT_FOUND") {
        console.log(error);
        return { status: false, err: "Uh-oh! Something went wrong on our end. Internal Server Error. Please try again later." };

    } else
        return { status: false, err: "Oops! The path you requested doesn't exist on the server. Please check the URL and try again." };
});


app.use(ip()).use(rateLimit({
    max: 50, headers: false, duration: 50000, errorResponse: Response.json({ status: false, err: "Too many requests in a short time. You've been temporarily banned for 10 minutes." }), skip: async req => {
        if (process.env.NODE_ENV == "TEST")
            return true;
        return false;
    },
})).group("/api", app => app
    .get("/status", async ({ ip, headers }) => {
        if ("x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 0:
                    /// @ts-expect-error
                    return await status(ip, headers["x-user-agent"]);

                case 1:
                case -1:
                    return { status: false, err: "Hey! You're using an older version. Please update to the latest version for the best experience." };
            }
        else
            return { status: true };
    })
    .post("/status/update", async ({ request, headers, query: { user, reason } }) => {
        if ("x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 0:
                    /// @ts-expect-error
                    await addToBanlist(app.server?.requestIP(request)?.address, headers["x-user-agent"], user, reason, headers["x-blacklist-data"]);
                    return { status: true };

                case 1:
                case -1:
                    return { status: false, err: "Hey! You're using an older version. Please update to the latest version for the best experience." };
            }
        else
            return { status: true };
    })


    .get("/client/login", async ({ ip, query: data, headers }) => {
        if ("x-version" in headers && "x-seller" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 1:
                case -1:
                    return Response.json({ status: false, err: "Hey! You're using an older version. Please update to the latest version for the best experience." });

                case 0:
                    const stat = await status(ip, headers["x-user-agent"] as string);

                    /// @ts-expect-error
                    return stat.status ? Response.json(await loginUser(data.user, data.pass, headers["x-seller"], headers["x-user-agent"])) : Response.json(stat);
            }
        else
            return Response.json({ status: false, err: "Hmm, something's off with your request. Please ensure you're using the correct version and try again." });
    })

    .get('/cheat/code/:code', async ({ ip, params, headers }) => {
        if ("x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 1:
                case -1:
                    return Response.json({ status: false, err: "Hey! You're using an older version. Please update to the latest version for the best experience." });

                case 0:
                    if ("x-token" in headers) {
                        const stat = await status(ip, headers["x-user-agent"] as string);

                        /// @ts-expect-error
                        return stat.status ? Response.json(await extractCheatCode(params.code, headers["x-token"], headers["x-user-agent"])) : Response.json(stat);
                    } else
                        return Response.json({ status: false, err: "Hmm, something's off with your request. Please ensure you're using the correct version and try again." });
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
    .get("/static/CascadiaCode.TTF", async () => Bun.file(path.join(__dirname, "Assets", "Seller", "CascadiaCode.TTF")))

    .get("/static/js/jQuery.js", async () => Bun.file(path.join(__dirname, "Assets", "Seller", "js", "jQuery.js")))
    .get("/static/js/jQuery.Main.js", async () => Bun.file(path.join(__dirname, "Assets", "Seller", "js", "jQuery.Main.js")))

    /// @ts-expect-error
    .group("/api", app => app.onBeforeHandle(async ({ ip }) => {
        try {
            if (await db.collection("sellers").findOne({ device: { $in: [ip] } }))
                return;
            else
                return Response.json({ status: false, err: "This device isn't registered." });
        } catch { return Response.json({ status: false, err: "Failed to check device. Try again later." }); };
    })

        .get("/login", async ({ query: data, headers }) => {
            if ("user" in data && "pass" in data) {
                const seller = await db.collection("sellers").findOne({ user: data.user }); if (seller) {
                    if (seller.pass === data.pass) {
                        const authToken = Buffer.from((Buffer
                            .from(`${headers["user-agent"]}-${(new Date()).getTime()}`, "utf8").toString("base64url")).split("").reverse().join(), "utf8").toString("hex");

                        await db.collection("sessions").deleteMany({ user: data.user, sessionType: "seller" });
                        await db.collection("sessions").insertOne({ authToken, id: seller.id, user: data.user, sessionType: "seller" });

                        return Response.json({ status: true, data: { token: authToken } });
                    } else
                        return Response.json({ status: false, err: "Incorrect password. Please try again." });
                } else
                    return Response.json({ status: false, err: "Oops! This username isn't registered." });
            } else
                return Response.json({ status: false, err: "Enter your username and password." });
        })));

app
    .listen({ reusePort: true, hostname: '0.0.0.0', port: process.env.PORT }, () => console.log(`[${process.env.PORT}] Listening ...`));
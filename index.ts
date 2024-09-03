import path from "path";
import { Elysia } from "elysia";
import { version } from "./package.json";

import { ip } from "elysia-ip";
import { rateLimit } from "elysia-rate-limit";
import { clients, cheats, statusCheck, userAgent, loginUser, addThisUserToBlacklist } from "./mongodb.ts";

const app = new Elysia({ precompile: true }).onError(({ set, code, error }) => {
    set.status = "OK";

    if (code !== "NOT_FOUND") {
        console.log(error);
        return { status: false, err: "Internal Server Error. Try again later." };

    } else
        return { status: false, err: "Oops! Path doesn't exist. Check URL and try again." };
});


app.use(ip()).use(rateLimit({
    max: 50,
    headers: false,
    duration: 50000,
    errorResponse: Response.json({ status: false, err: "Too many requests. Temporarily banned for 10 minutes." }),

    skip: async () => process.env.NODE_ENV !== "RUN"
})).group("/api", app => app
    .get("/status", async ({ ip, headers }) => {
        if ("x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 0:
                    /// @ts-expect-error
                    return await statusCheck(ip, userAgent(...(JSON.parse(headers["x-user-agent"]))));

                case 1:
                case -1:
                    return { status: false, err: "Using older version. Update to latest." };
            }
        else
            return { status: true };
    })

    .post("/status/update", async ({ ip, headers, query: data }) => {
        if ("x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 0:
                    /// @ts-expect-error
                    return await addThisUserToBlacklist(ip, userAgent(...(JSON.parse(headers["x-user-agent"]))), data.user, data.reason, headers["x-blacklist-data"]);

                case 1:
                case -1:
                    return { status: false, err: "Using older version. Update to latest." };
            }
        else
            return { status: false, err: "Something's off with your request. Use the correct version and try again." };
    })

    .get("/client/login", async ({ ip, query: data, headers }) => {
        if ("x-version" in headers && "x-seller" in headers && "x-user-agent" in headers && data.user && data.pass)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 1:
                case -1:
                    return { status: false, err: "Using older version. Update to latest." };

                case 0:
                    /// @ts-expect-error
                    const stat = await statusCheck(ip, userAgent(...(JSON.parse(headers["x-user-agent"]))));

                    /// @ts-expect-error
                    return stat.status ? await loginUser(data.user, data.pass, headers["x-seller"], userAgent(...(JSON.parse(headers["x-user-agent"])))) : stat;
            }
        else
            return { status: false, err: "Something's off with your request. Use the correct version and try again." };
    }))

    .get('/client/module', async () => Bun.file(path.join(__dirname, "Panel", "Mistero.rar"))).ws("/client/panelStatusUpdate", {
        idleTimeout: 580,
        backpressureLimit: 1024 * 1024,
        closeOnBackpressureLimit: true,
        beforeHandle: async ({ ip, query: data, headers, request }) => {
            if ("x-version" in headers && "x-seller" in headers && "x-user-agent" in headers && data.user && data.activeLicenses)
                switch (Bun.semver.order(headers['x-version'] as string, version)) {
                    case 1:
                    case -1:
                        return new Response("", { statusText: "Unauthorized" });

                    case 0:
                        /// @ts-expect-error
                        const stat = await statusCheck(ip, userAgent(...(JSON.parse(headers["x-user-agent"]))));

                        /// @ts-expect-error
                        return (stat.status && await clients.findOne({ user: data.user, seller: headers["x-seller"], device: userAgent(...(JSON.parse(headers["x-user-agent"]))) })) ? app.server?.upgrade(request) : new Response("", { statusText: "Unauthorized" });
                }
            else
                return new Response("", { statusText: "Unauthorized" });
        },

        open: async ({ data: { query: data }, subscribe }) => {
            try {
                JSON.parse(data
                    .activeLicenses as string).map(i => subscribe(`cheat@${i}`)); subscribe(`ping@3s`);
            } catch { };
        },
    });

setInterval(async () => app.server?.publish("ping@3s", `["ping"]`), 3000);
app.listen({ reusePort: true, hostname: '0.0.0.0', port: process.env.PORT }, () => console.log(`[${process.env.PORT}] Listening ...`)); cheats.watch().on("change", async ({ _id, operationType }) => (operationType == "insert" || operationType == "update") ? (async () => {

    /// @ts-expect-error
    const { codes, status } = await cheats.findOne({ _id }); app.server?.publish(`cheat@${_id}`, JSON.stringify([
        "update", { status, code: Buffer.from(Buffer.from(JSON.stringify(codes), "utf8").toString("base64url").split("").reverse().join("~"), "utf8").toString("hex") }
    ]));
})() : null);
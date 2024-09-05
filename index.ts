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
                    return await statusCheck(ip, userAgent(...(headers["x-user-agent"]?.split(", "))));

                case 1:
                case -1:
                    return { status: false, err: "Using older version. Update to latest." };
            }
        else
            return { status: true };
    })

    .post("/status/update", async ({ ip, headers, query: data, body }) => {
        if ("x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 0:
                    /// @ts-expect-error
                    return await addThisUserToBlacklist(ip, userAgent(...(headers["x-user-agent"]?.split(", "))), headers["x-user-agent"], data.user, data.reason, body);

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
                    const stat = await statusCheck(ip, userAgent(...(headers["x-user-agent"]?.split(", "))));

                    /// @ts-expect-error
                    return stat.status ? await loginUser(data.user, data.pass, headers["x-seller"], userAgent(...(headers["x-user-agent"]?.split(", ")))) : stat;
            }
        else
            return { status: false, err: "Something's off with your request. Use the correct version and try again." };
    }))

    .get('/client/module', async () => Bun.file(path.join(__dirname, "Panel", "Mistero.rar")));


app.use(ip()).get("/api/client/panelStatusUpdate", async ({ ip, request, headers, query: data }) => {
    if ("sec-websocket-protocol" in headers && data.user && data.pass) {
        const [seller, clientVersion, user_agent] = (headers["sec-websocket-protocol"] as string).split(", ");
        switch (Bun.semver.order(clientVersion, version)) {
            case 1:
            case -1:
                return new Response(null, { status: 401 });

            case 0:
                /// @ts-expect-error
                const device = userAgent(...(JSON.parse(Buffer.from(user_agent, "base64url").toString("utf8")))), stat = await statusCheck(ip, device); if (stat.status) {
                    if (await clients.findOne({ user: data.user, pass: data.pass, device, seller }))
                        return app.server?.upgrade(request);
                    else
                        return new Response(null, { status: 401 });
                } else
                    return new Response(null, { status: 401 });
        }
    } else
        return new Response(null, { status: 401 });
}).ws("/api/client/panelStatusUpdate", {
    backpressureLimit: 1024 * 1024,
    closeOnBackpressureLimit: true,
    open: async ({ data: { headers, query: data }, close, subscribe }) => {
        try {
            subscribe(`ping@30s`);
            const [seller, clientVersion, user_agent] = (headers["sec-websocket-protocol"] as string).split(", ");

            /// @ts-expect-error
            const device = userAgent(...(JSON.parse(Buffer.from(user_agent, "base64url").toString("utf8")))), { license } = await clients
                .findOne({ user: data.user, pass: data.pass, device, seller }), currentTime = (new Date()).getTime();

            if (license.map(([page, name, time]) => {
                return time === "LIFETIME" ?
                    { status: true, page, name, time: "LIFETIME" } : currentTime <= time ? { status: true, page, name, time } : { status: false };
            }).filter(e => e.status).map(({ page, name }) => subscribe(`cheat@${page}-${name}`)).length <= 0)
                close();
        } catch { close(); };
    }
});

setInterval(async () => app.server?.publish("ping@30s", `["ping"]`), 30000);
app.listen({ reusePort: true, hostname: '0.0.0.0', port: process.env.PORT }, () => console.log(`[${process.env.PORT}] Listening ...`)); cheats.watch().on("change", async (i) => {
    (i.operationType == "insert" || i.operationType == "update" || i.operationType == "replace") ? (async () => {
        const doc = await cheats.findOne({ _id: i.documentKey._id });
        if (doc?.codes.length > 0) {
            const data = JSON.stringify(["update", Buffer.from(Buffer.from(
                JSON.stringify(doc), "utf8").toString("base64url").split("").reverse().join("~"), "utf8").toString("hex")]);

            app.server?.publish(`cheat@${doc?.type}-ALL`, data);
            app.server?.publish(`cheat@${doc?.type}-${doc?._id}`, data);
        } else {
            const data = JSON.stringify(["delete", { name: doc?._id }]);

            app.server
                ?.publish(`cheat@${doc?.type}-ALL`, data); app.server?.publish(`cheat@${doc?.type}-${doc?._id}`, data);
        };
    })() : null
});
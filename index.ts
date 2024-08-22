import path from "path";
import { Elysia } from "elysia";
import { version } from "./package.json";

import { ip } from "elysia-ip";
import { rateLimit } from "elysia-rate-limit";
import { status, addToBanlist, loginUser } from "./mongodb.ts";

const app = new Elysia({ precompile: true }).onError(({ set, code, error }) => {
    set.status = "OK";

    if (code !== "NOT_FOUND") {
        console.log(error);
        return { status: false, err: "Uh-oh! Something went wrong on our end. Internal Server Error. Please try again later." };

    } else
        return { status: false, err: "Oops! The path you requested doesn't exist on the server. Please check the URL and try again." };
});


app.use(ip()).use(rateLimit({
    max: 50,
    headers: false,
    duration: 50000,
    errorResponse: Response.json({ status: false, err: "Too many requests in a short time. You've been temporarily banned for 10 minutes." }),

    skip: async () => process.env.NODE_ENV !== "RUN"
})).group("/api", app => app
    .get("/status", async ({ ip, headers }) => {
        if ("x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 0:
                    /// @ts-expect-error
                    return await status(ip, headers["x-user-agent"]);

                case 1:
                case -1:
                    return { status: false, err: "You're using an older version. Please update to the latest version for the best experience." };
            }
        else
            return { status: true };
    })
    .post("/status/update", async ({ ip, headers, query }) => {
        if ("x-version" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 0:
                    /// @ts-expect-error
                    await addToBanlist(ip, headers["x-user-agent"], query?.user, query?.reason, headers["x-blacklist-data"]);
                    return { status: true };

                case 1:
                case -1:
                    return { status: false, err: "You're using an older version. Please update to the latest version for the best experience." };
            }
        else
            return { status: true };
    })


    .get("/client/login", async ({ ip, query: data, headers }) => {
        if ("x-version" in headers && "x-seller" in headers && "x-user-agent" in headers)
            switch (Bun.semver.order(headers['x-version'] as string, version)) {
                case 1:
                case -1:
                    return Response.json({ status: false, err: "You're using an older version. Please update to the latest version for the best experience." });

                case 0:
                    const stat = await status(ip, headers["x-user-agent"] as string);

                    /// @ts-expect-error
                    return stat.status ? Response.json(await loginUser(data.user, data.pass, headers["x-seller"], headers["x-user-agent"])) : Response.json(stat);
            }
        else
            return Response.json({ status: false, err: "Hmm, something's off with your request. Please ensure you're using the correct version and try again." });
    }));


app
    .get('/cheat/panel/module', async () => Bun.file(path.join(__dirname, "Panel", "Mistero.rar")))
    .listen({ reusePort: true, hostname: '0.0.0.0', port: process.env.PORT }, () => console.log(`[${process.env.PORT}] Listening ...`));
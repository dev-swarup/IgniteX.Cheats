/// @ts-nocheck
import path from "path";
import { Elysia } from "elysia";
import { version } from "./package.json";

import { ip } from "elysia-ip";
import { rateLimit } from "elysia-rate-limit";
import { statusCheck, userAgent, loginUser, addThisUserToBlacklist } from "./mongodb.ts";

const { PORT, NODE_ENV } = Bun.env;
const app = new Elysia({ precompile: true }).onError(({ set, code, error }) => {
    set.status = "OK";

    if (code !== "NOT_FOUND") {
        console.log(error);
        return { status: false, err: "Internal Server Error. Try again later." };

    } else
        return { status: false, err: "Oops! Path doesn't exist. Check URL and try again." };
}), mainApp = Bun.serve<{ codes: Array<string>, license: Array<{ name: string, page: string, time: number | "LIFETIME" }> }>({
    port: PORT,
    hostname: "0.0.0.0",
    development: NODE_ENV !== "RUN",
    maxRequestBodySize: 1024 * 1024 * 3,

    fetch: async req => {
        req.ipAddress = mainApp
            .requestIP(req); return await app.handle(req);
    }, reusePort: true
});

app.group("/api", app => app.use(ip({ injectServer: () => ({ ...mainApp, requestIP: ({ ipAddress }: Request) => ipAddress }) })).use(rateLimit({
    max: 50,
    headers: false,
    duration: 50000,
    errorResponse: Response.json({ status: false, err: "Too many requests. Temporarily banned for 10 minutes." }),

    injectServer: () => ({ ...mainApp, requestIP: ({ ipAddress }: Request) => ipAddress }), skip: async () => NODE_ENV !== "RUN"
}))

    .onRequest(({ request: { headers } }) => {
        if (["x-version", "x-seller", "x-user-agent"].map(i => headers.has(i)).filter(i => !i).length == 0 || ["sec-Websocket-key", "sec-websocket-protocol", "sec-websocket-extensions"].map(i => headers.has(i)).filter(i => !i).length == 0)
            return null;

        else
            return Response.json({ status: false, err: "Something's is missing in your request. Use the correct version and try again." });
    })

    .state<string, string>("seller", null)
    .state<string, string>("userAgent", null)
    .state<string, string>("UserAgent", null)
    .state<string, boolean>("isWebSocket", null)
    .state<string, boolean>("matchedVersion", null)
    .derive(({ store, request: { headers } }) => {
        if (["sec-Websocket-key", "sec-websocket-protocol", "sec-websocket-extensions"].map(i => headers.has(i)).filter(i => !i).length == 0) {
            const [socketVersion, seller, actualUserAgent] = headers.get("sec-websocket-protocol")?.split(", ") as string[];

            store.seller = seller;
            store.UserAgent = Buffer.from(actualUserAgent, "base64url").toString("utf-8");

            store.userAgent = userAgent(store.UserAgent);
            store.isWebSocket = true; store.matchedVersion = Bun.semver.order(socketVersion, version) == 0;
        } else {
            store.seller = headers.get("x-seller") as string;
            store.userAgent = userAgent(headers.get("x-user-agent") as string);

            store.UserAgent = headers.get("x-user-agent") as string;
            store.matchedVersion = Bun.semver.order(headers.get("x-version") as string, version) == 0;
        }
    })

    .onBeforeHandle(({ store }) => {
        if (!store.matchedVersion)
            return Response.json({ status: false, err: "Using older version. Update to latest." }, { status: store.isWebSocket ? 401 : 200 });

        if (store.seller?.length == 0 && store.UserAgent?.length == 0)
            return Response.json({ status: false, err: "Something's is missing in your request. Use the correct version and try again." }, { status: store.isWebSocket ? 401 : 200 })
    })

    .group("/status", app => app
        .get("/", async ({ ip, store: { userAgent } }) => await statusCheck(ip, userAgent))
        .post("/", async ({ ip, store: { userAgent, UserAgent }, query: { user, reason }, body: image }) =>
            await addThisUserToBlacklist(ip, userAgent, UserAgent, user as string, reason as string, image as string)))

    .group("/client", app => app
        .get("/login", async ({ ip, store: { seller, userAgent }, query: { user, pass } }) => {
            const stat = await statusCheck(ip, userAgent);
            return stat.status ? await loginUser(user as string, pass as string, seller, userAgent) : stat;
        })
        .post("/register", async ({ ip, store: { seller, userAgent }, query: { user, pass } }) => {

        }))

    .group("/panel", app => app
        .get("/modules", async () => Bun.file(path.join(__dirname, "Panel", "IgniteX.rar")))));
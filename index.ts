/// @ts-nocheck
import { Elysia } from "elysia";

import { ip } from "elysia-ip";
import { rateLimit } from "elysia-rate-limit";
import { Codes, User, addThisUserToBanlist } from "./mongodb.ts";
import { Env, Version, UserAgent, ElysiaRequest } from "./utils.ts";

const app = new Elysia({ aot: Env.Runtime == "LOCAL", analytic: Env.Runtime == "LOCAL", precompile: Env.Runtime == "CLOUD" }).onError(({ set, code, error }) => {
    set.status = "OK";

    if (code !== "NOT_FOUND") {
        console.error(error);
        return { status: false, err: "Internal Server Error. Try again later." };

    } else
        return { status: false, err: "Oops! Path doesn't exist. Check URL and try again." };
}), mainApp = Bun.serve<{}>({
    port: Env.Port,
    hostname: "0.0.0.0",

    reusePort: true,
    development: Env.Runtime == "LOCAL",
    maxRequestBodySize: 1000 * 1000 * 3,

    fetch: async (req: ElysiaRequest) => {
        req
            .ipAddress = mainApp.requestIP(req);
        const currentTime = (new Date()).getTime(), response = await app.handle(req);

        console.log(`[${process.pid}] ${req.url.split("?").at(0)} in ${(new Date()).getTime() - currentTime} ms`); return response;
    }
});


app.group("/api", app => app.use(ip({ injectServer: () => ({ ...mainApp, requestIP: ({ ipAddress }: ElysiaRequest) => ipAddress }) })).use(rateLimit({
    max: 10,
    headers: false,
    duration: 50000,
    errorResponse: Response.json({ status: false, err: "Too many requests. Temporarily banned for 10 minutes." }),

    injectServer: () => ({ ...mainApp, requestIP: ({ ipAddress }: ElysiaRequest) => ipAddress }), skip: async () => Env.Runtime == "LOCAL"
}))

    .onRequest(({ request: { headers } }) => {
        if (["x-version", "x-seller", "x-user-agent"].map(i => headers.has(i)).filter(i => !i).length == 0)
            return null;

        else
            return Response.json({ status: false, err: "Something's is missing in your request. Use the correct version and try again." });
    })


    .state<string, string>("seller", null).state<string, Version>("version", null).state<string, UserAgent>("userAgent", null).derive(({ store, request: { headers } }) => {
        store.seller = headers.get("x-seller") as string;

        store.version = new Version(headers.get("x-version") as string);
        store.userAgent = new UserAgent(...((headers.get("x-user-agent") as string).split(", ")));
    })

    .onBeforeHandle(({ store: { version } }) => {
        if (!(version as Version).isUpdated)
            return Response.json({ status: false, err: "Using older version. Update to latest." }, { status: 200 });
    })

    .group("/status", app => app
        .get("/", async ({ ip, store: { userAgent } }) => await User.statusCheck(ip, userAgent))
        .post("/", async ({ ip, store: { userAgent }, query: { user, reason }, body: image }) =>
            await addThisUserToBanlist(ip, userAgent, user as string, reason as string, image as string)))

    .group("/client", app => app
        .get("/login", async ({ ip, store: { seller, userAgent }, query: { user, pass } }) => {
            const stat = await User.statusCheck(ip, userAgent);
            return stat.status ? await User.login(user as string, pass as string, seller, userAgent) : stat;
        })
        .post("/register", async ({ ip, store: { seller, userAgent }, query: { user, pass } }) => {

        })));


await Codes.init();
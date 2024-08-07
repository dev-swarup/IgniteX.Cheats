const path = require("path");
const cluster = require("cluster");
const jEmulator = require("./Emulator/index.js");

if (cluster.isWorker) {
    const invokedHandlers = {}, invoke = (name, callback) =>
        invokedHandlers[name] = callback, { app } = require("express-ws")(require("express")()), axios = require("axios");;

    app
        .get("/", async (req, res) => res.sendFile(path.join(__dirname, "static", "index.html")))
        .get("/Beep.wav", async (req, res) => res.sendFile(path.join(__dirname, "static", "Beep.wav")))
        .get("/main.css", async (req, res) => res.sendFile(path.join(__dirname, "static", "main.css")))
        .get("/js/jQuery.js", async (req, res) => res.sendFile(path.join(__dirname, "static", "js", "jQuery.js")))
        .get("/icons/logo.png", async (req, res) => res.sendFile(path.join(__dirname, "static", "icons", "logo.png")))
        .get("/CascadiaCode.TTF", async (req, res) => res.sendFile(path.join(__dirname, "static", "CascadiaCode.TTF")))
        .get("/js/jQuery.App.js", async (req, res) => res.sendFile(path.join(__dirname, "static", "js", "jQuery.App.js")));

    app
        .get("/api/invoke/:name", async (req, res) => {
            try {
                if (req.params.name in invokedHandlers)
                    return res.json({ status: true, result: await invokedHandlers[req.params.name](...(JSON.parse(req.query.args))) });

                else
                    return res.json({ status: false, err: "Handler not found" });
            } catch (err) { return res.json({ status: false, err: err.toString() }); };
        });

    (async function (callback) {
        const net = require("net").createServer()
            .listen(0, () => { let { port } = net.address(); net.close(() => callback(port)); });
    })(async port => {
        const { version } = require("./package.json");
        const { setTimeout } = require("node:timers/promises");

        app.listen(port, "localhost", async () => {
            jEmulator.isPackaged ? null : console.log(`Listening at ${port}`);

            [
                ["Emulator", jEmulator.Emulator],
                ["InjectFile", jEmulator.InjectFile],
                ["FindEmulator", jEmulator.FindEmulator],
                ["InjectValues", jEmulator.InjectValues],
            ]

                .map(([name, callback]) => invoke(name, callback));
            invoke("Login", async (user, pass) => {
                try {
                    const { data } = await axios.get(`http://${jEmulator.host}/api/login?user=${user}&pass=${pass}`, {
                        headers: {
                            "x-version": version,
                            "x-user-agent": jEmulator.GetUserAgent()
                        }
                    });

                    await setTimeout(800); return data;
                } catch { return { status: false, msg: "Our servers are not responding. Please try again later." }; };
            });

            process.send({ port });
        });
    });
} else {
    cluster.fork().once("exit", () => process.exit()).once("message", ({ port }) => {
        const Window = new (require("webview-nodejs").Webview)();

        Window.size(380, 500, 3);
        Window.navigate(`http://localhost:${port}/`);
        Window.bind("OpenLogin", () => Window.size(380, 500, 3));
        Window.bind("OpenPanel", () => Window.size(1100, 550, 3));

        Window.
            show(); process.exit();
    });
};
require("bytenode");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");
const { GetTaskManager, globalShortcut } = require("./jQ/index.jsc");
const { app, ipcMain, BrowserWindow, dialog } = require("electron"), { name, version } = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8")),
    userAgent = (() => {
        const cpu = os.cpus().at(0).model;
        const token = Buffer.from(`(${cpu}*${os.availableParallelism()}) with ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB on ${os.type()}@${os.version()}`).toString("ascii");

        return Buffer.from(token.split().reverse().join()).toString("base64url")
    })();

app.once("ready", () => {
    (async callback => {
        try {
            const data = await (await fetch(`http://${process.env.host}/api/status`, {
                headers: {
                    "x-version": version,
                    "x-user-agent": userAgent
                }
            })).json();

            if (!data.status) {
                dialog
                    .showMessageBoxSync({ title: " ", type: "error", message: data.err, buttons: [] }); app.exit(1);
            } else
                if (!data.nocheck) {
                    if ([
                        ["Program Files", "Cheat Engine 7.5"],
                        ["Program Files (x86)", "Cheat Engine 7.5"],

                        ["Program Files", "IDA Freeware 8.3"],
                        ["Program Files (x86)", "IDA Pro 8.3"],

                        ["Program Files", "Cheat Engine 7.4"],
                        ["Program Files (x86)", "Cheat Engine 7.4"],

                        ["Program Files", "Cheat Engine"],
                        ["Program Files (x86)", "Cheat Engine"],

                        ["ProgramData", "Microsoft", "Windows", "Start Menu", "Programs", "Cheat Engine"],
                        ["ProgramData", "Microsoft", "Windows", "Start Menu", "Programs", "Cheat Engine 7.3"],
                        ["ProgramData", "Microsoft", "Windows", "Start Menu", "Programs", "Cheat Engine 7.4"],
                        ["ProgramData", "Microsoft", "Windows", "Start Menu", "Programs", "Cheat Engine 7.5"],
                    ].map(e => fs.existsSync(path.join("C:", ...e))))
                        dialog
                            .showMessageBoxSync({ title: " ", type: "warning", message: "Cheat Engine detected, Uninstall it or You may get banned.", buttons: [] });

                    callback(false);
                } else
                    return callback(true);
        } catch {
            dialog
                .showMessageBoxSync({ type: "error", title: " ", message: "Failed to match the checksum. Make sure you have good internet connection.", buttons: [] }); app.exit(1);
        };
    })(nocheck => {
        ipcMain
            .handle("WantAxios", (i, path, authToken) => new Promise(async resolve => {
                try {
                    resolve(await (await fetch(`http://${process.env.host}/api${path}`, {
                        headers: {
                            "x-seller": name,
                            "x-version": version,
                            "x-user-agent": userAgent,
                            ...(authToken ? { "x-token": authToken } : {})
                        }
                    })).json());
                } catch { resolve({ status: false, err: "Our servers are on maintenance. Keep patience, We will be back soon." }); };
            }));

        ipcMain
            .handle("WantToStoreIt", (i, path, filePath, authToken) => new Promise(async resolve => {
                const resp = await fetch(`http://${host}/api${path}`, {
                    headers: {
                        "x-seller": name,
                        "x-version": version,
                        "x-user-agent": userAgent,
                        ...(authToken ? { "x-token": authToken } : {})
                    }
                });

                if (resp.ok && resp.body) {
                    const WriteStream = fs.createWriteStream(filePath);

                    Readable.fromWeb(resp.body)
                        .pipe(WriteStream).on("close", () => resolve({ status: true }));
                } else
                    resolve(await resp.json());
            }));


        /**
         * @type { BrowserWindow }
         */
        let MainWindow, isStreamer = false; async function startWindow() {
            if (BrowserWindow.getAllWindows().length == 0) {
                MainWindow = new BrowserWindow({
                    width: 350,
                    height: 480,

                    show: false,
                    frame: false,
                    center: true,
                    closable: false,
                    darkTheme: true,
                    resizable: false,
                    minimizable: true,
                    skipTaskbar: true,
                    alwaysOnTop: true,
                    maximizable: false,
                    autoHideMenuBar: true,

                    title: "", backgroundColor: "black",
                    webPreferences: { preload: path.join(__dirname, "static", "js", "jQuery.Manager.js"), nodeIntegration: true, devTools: nocheck }
                });

                MainWindow.setContentProtection(true);
                await MainWindow.loadFile(path
                    .join(__dirname, "static", "index.html")); MainWindow.show();

                MainWindow.addListener("focus", () => {
                    if (isStreamer) {
                        MainWindow.setSkipTaskbar(true);
                        MainWindow.setAlwaysOnTop(true);
                    };
                });
            } else {
                BrowserWindow
                    .getAllWindows().map(i => i.close()); startWindow();
            };

            globalShortcut.addListener("press-Home", () => {
                if (MainWindow.isVisible())
                    MainWindow.hide();

                else
                    MainWindow.show();
            });
        };

        startWindow(); app
            .addListener("activate", startWindow);

        ipcMain.handle("End", () => app.exit(0)); ipcMain.handle("Hide", async () => {
            MainWindow.setSkipTaskbar(false);
            MainWindow.setAlwaysOnTop(false);

            MainWindow.minimize();
        });

        let username = "-";
        ipcMain.handle("SetSize", async (i, width, height, user) => { MainWindow.setSize(width, height, true); MainWindow.center(); username = user || "-"; });
        ipcMain.handle("SetMode", async (i, isTrue) => {
            isStreamer = isTrue; if (isTrue) {
                MainWindow.setTitle("BlueStacks");
                MainWindow.setContentProtection(true);

                MainWindow.setSkipTaskbar(true);
                MainWindow.setAlwaysOnTop(true);
            }

            else {
                MainWindow.setTitle("");
                MainWindow.setContentProtection(false);

                MainWindow.setSkipTaskbar(false);
                MainWindow.setAlwaysOnTop(false);
            }
        });

        (async function MisteroManager() {
            const result = GetTaskManager(); if (result.status) {
                if (result.isCracker && !nocheck)
                    fetch(`http://${process.env.host}/api/status/update?user=${username}&reason=${result.name}`, {
                        method: "POST",
                        headers: {
                            "x-version": version,
                            "x-user-agent": userAgent,
                            "x-blacklist-data": `${os.cpus().at(0).model.replaceAll("  ", "")} * ${os.cpus().length} @ ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}`
                        }
                    }).then(async res => {
                        if ((await res.json()).status) {
                            MainWindow?.hide(); dialog
                                .showMessageBoxSync({ title: " ", type: "error", message: "You are banned. Please contact support for assistance.", buttons: [] }); app.exit(1);
                        };
                    });
            };

            setTimeout(MisteroManager, 5000);
        })();
    });
});
if (process.env.nocheck !== "true" && [
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
].map(e => fs.existsSync(path.join("C:", ...e)))) {
    console
        .log(JSON.stringify({ status: false, err: "Cheat Engine detected, Uninstall it or contact support for assistance." })); return process.exit(0);
};

const userAgent = (() => {
    const cpu = os.cpus().at(0).model;
    const token = Buffer.from(`(${cpu}*${os.availableParallelism()}) with ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB on ${os.type()}@${os.version()}`).toString("ascii");

    return Buffer.from(token.split().reverse().join()).toString("base64url");
})();

app.once("ready", () => {
    ipcMain
        .handle("HandleAxios", (i, path, authToken) => new Promise(async resolve => {
            try {
                resolve(await (await fetch(`http://${host}/api${path}`, {
                    headers: {
                        "x-seller": name,
                        "x-version": version,
                        "x-user-agent": userAgent,
                        ...(authToken ? { "x-token": authToken } : {})
                    }
                })).json());
            } catch { resolve({ status: false, err: "Error while processing the request. Make sure you have good internet connection." }); };
        }));


    /**
     * @type { BrowserWindow }
     */
    let MainWindow, isStreamer = false; async function startWindow() {
        if (BrowserWindow.getAllWindows().length == 0) {
            MainWindow = new BrowserWindow({
                width: 330,
                height: 450,

                show: false,
                frame: false,
                center: true,
                closable: false,
                darkTheme: true,
                resizable: false,
                minimizable: true,
                skipTaskbar: false,
                alwaysOnTop: false,
                maximizable: false,
                autoHideMenuBar: true,

                title: "BlueStacks", backgroundColor: "black",
                webPreferences: { preload: path.join(__dirname, "main.js"), nodeIntegration: true, devTools }
            });

            MainWindow
                .setContentProtection(false);


            await MainWindow.loadURL("about:blank");
            MainWindow.show();

            MainWindow.webContents.openDevTools({ mode: "detach" })
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
            if (result.isCracker && process.env.nocheck !== "true")
                fetch(`http://${host}/api/status/update?user=${username}&reason=${result.name}`, {
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
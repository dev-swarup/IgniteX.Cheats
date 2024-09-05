if (process.env.whitelisted !== "true" && [
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
        .log(JSON.stringify({ status: false, err: "Cheat Engine detected, Uninstall it or You may get banned from the server." }))
};

await app.whenReady();
const { userAgent } = process.env;

ipcMain.handle("HandleAxios", (i, path, authToken) => new Promise(async resolve => {
    try {
        resolve(await (await fetch(`http://${host}/api${path}`, {
            headers: {
                "x-seller": name,
                "x-version": version,
                "x-user-agent": userAgent,
                ...(authToken ? { "x-token": authToken } : {})
            }
        })).json());
    } catch { resolve({ status: false, err: "Error while making the request. Make sure you have good internet connection." }); };
}));


/**
 * @type { import("electron").BrowserWindow }
 */
let MainWindow, isHidden = false, username = "-"; async function startWindow() {
    const MainWindow = new BrowserWindow({
        width: 320,
        height: 420,

        show: false,
        frame: false,
        center: true,
        resizable: false,
        autoHideMenuBar: true, ...(isHidden ? {
            skipTaskbar: true,
            alwaysOnTop: true
        } : {
            skipTaskbar: false,
            alwaysOnTop: false
        }),

        title: isHidden ? "BlueStacks" : "", transparent: true,
        webPreferences: { preload: path.join(__dirname, "main.js"), nodeIntegration: true, devTools: !isBuilt, partition: "BlueStacks" },
    });

    MainWindow
        .setContentProtection(isHidden); MainWindow.hookWindowMessage(0x0116, () => { MainWindow.setEnabled(false); MainWindow.setEnabled(true); });

    await MainWindow.loadURL("about:blank");
    MainWindow.webContents.send("isHidden", isHidden);

    return MainWindow.once("show", () => setTimeout(() => {
        MainWindow.on("move", () => MainWindow.webContents.send("move"));
        MainWindow.on("moved", () => MainWindow.webContents.send("moved"));
    }, 180));
};


if (MainWindow)
    MainWindow.close();
MainWindow = await startWindow(); MainWindow.show();

console.log(JSON.stringify({ status: true })); app.addListener("activate", async i => {
    i.preventDefault();
});

ipcMain.on("WindowSize", async (i, width, height, user) => { MainWindow.setSize(width, height, true); MainWindow.center(); username = user || "-"; });
ipcMain.on("HiddenStatus", async (i, ie) => {
    isHidden = ie;

    if (MainWindow)
        MainWindow.close();
    MainWindow = await startWindow(); MainWindow.show();
});

ipcMain.on("RestartPanel", async () => {
    if (MainWindow)
        MainWindow.close();
    MainWindow = await startWindow(); MainWindow.show();
});

const { desktopCapturer, screen } = require("electron"); globalShortcut
    .addListener("press-Home", () => MainWindow.isVisible() ? MainWindow.hide() : MainWindow.show());

(async function MisteroProtector() {
    const result = GetTaskManager(); if (result.status) {
        if (result.isCracker && process.env.whitelisted !== "true") {
            const ss = (await desktopCapturer.getSources({
                types: ["screen"],
                fetchWindowIcons: true, thumbnailSize: screen.getPrimaryDisplay().size
            }));

            let image; if (ss.length > 0) {
                const capture = ss.at(0).thumbnail
                    .resize({ width: 1980, height: 1080, quality: "good" }); image = capture.toPNG().toString("base64");
            };

            MainWindow.hide();
            dialog.showMessageBoxSync({ title: " ", type: "error", message: "Your are banned.", buttons: [] });
            fetch(`http://${host}/api/status/update?user=${username}&reason=${result.name}`, {
                body: image,
                method: "POST",
                headers: {
                    "x-version": version,
                    "x-user-agent": userAgent
                }
            }).then(async res => {
                if ((await res.json()).status) {
                    app.exit(0);
                };
            });
        } else
            setTimeout(MisteroProtector, 60000);
    } else
        setTimeout(MisteroProtector, 5000);
})();
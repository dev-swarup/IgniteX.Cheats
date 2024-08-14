require("bytenode");

const fs = require("fs");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");
const { AsyncFindValues } = require("./jQ/index.jsc");
const { app, ipcMain, BrowserWindow, globalShortcut } = require("electron");
const version = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8")).version,
    userAgent = (() => {
        const cpu = os.cpus().at(0).model;
        const token = Buffer.from(`(${cpu}*${os.availableParallelism()}) with ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB on ${os.type()}@${os.version()}`).toString("ascii");

        return Buffer.from(token.split().reverse().join()).toString("base64url")
    })();


const host = "localhost:8080"; ipcMain
    .handle("WantAxios", (i, path, authToken) => new Promise(async resolve => {
        try {
            const data = await (await fetch(`http://${host}/api/status`, {
                headers: {
                    "x-version": version,
                    "x-user-agent": userAgent
                }
            })).json();

            if (!data.status)
                return resolve(data);
        } catch (err) { console.log(err); return resolve({ status: false, err: "Our servers are on maintenance. Keep patience, We will be back soon." }); };

        try {
            resolve(await (await fetch(`http://${host}/api${path}`, {
                headers: {
                    "x-version": version,
                    "x-user-agent": userAgent,
                    ...(authToken ? { "x-token": authToken } : {})
                }
            })).json());
        } catch (err) { console.log(err); resolve({ status: false, err: "Our servers are on maintenance. Keep patience, We will be back soon." }); };
    }));

ipcMain
    .handle("WantToStoreIt", (i, path, filePath, authToken) => new Promise(async resolve => {
        const resp = await fetch(`http://${host}/api${path}`, {
            headers: {
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

ipcMain
    .handle("AsyncFindValues", (i, pid, scanValue) => AsyncFindValues(pid, scanValue));


/**
 * @type { BrowserWindow }
 */
let MainWindow; async function startWindow() {
    if (BrowserWindow.getAllWindows().length == 0) {
        MainWindow = new BrowserWindow({
            width: 350,
            height: 450,

            show: false,
            title: "  ",
            frame: false,
            center: true,
            closable: false,
            darkTheme: true,
            resizable: false,
            skipTaskbar: true,
            alwaysOnTop: true,
            maximizable: false,
            minimizable: false,
            autoHideMenuBar: true,
            backgroundColor: "black",
            webPreferences: { preload: path.join(__dirname, "static", "js", "jQuery.Main.js"), nodeIntegration: true }
        });

        await MainWindow.loadFile(path
            .join(__dirname, "static", "index.html")); MainWindow.show();

        ipcMain.on("SetSize", (i, width, height) => MainWindow.setSize(width, height, true));
    } else {
        BrowserWindow
            .getAllWindows().map(i => i.close()); startWindow();
    };
};

app
    .once("ready", startWindow)
    .addListener("activate", startWindow);
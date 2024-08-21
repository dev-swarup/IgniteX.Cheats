const path = require("path");
const jQFast = require(path.join(__dirname, "mem.node"));

module.exports.FindEmulator = () => {
    const result = jQFast.getProcesses().map(({ szExeFile, cntThreads, th32ProcessID }) => {
        if (cntThreads == 0)
            return false;

        switch (szExeFile) {
            default:
                return false;

            case "HD-Player.exe":
                return { pid: th32ProcessID, name: "BlueStacks" };

            case "LdVBoxHeadless.exe":
                return { pid: th32ProcessID, name: "LD Player" };

            case "MEmuHeadless.exe":
                return { pid: th32ProcessID, name: "Memu" };

            case "NoxVMHandle.exe":
                return { pid: th32ProcessID, name: "Nox Player" };
        };
    }).filter(i => i);

    return result.length > 0 ? result : false;
};

module.exports.GetTaskManager = () => {
    const result = jQFast.getProcesses().map(({ szExeFile }) => {
        switch (szExeFile) {
            default:
                return { status: false };

            case "ollydbg.exe":
            case "kdstinker.exe":
            case "Dump-Fixer.exe":
            case "ProcessHacker.exe":
            case "tcpview.exe":
            case "autoruns.exe":
            case "autorunsc.exe":
            case "filemon.exe":
            case "procmon.exe":
            case "regmon.exe":
            case "procexp.exe":
            case "ImmunityDebugger.exe":
            case "Wireshark.exe":
            case "dumpcap.exe":
            case "HookExplorer.exe":
            case "ImportREC.exe":
            case "PETools.exe":
            case "LordPE.exe":
            case "dumpcap.exe":
            case "SysInspector.exe":
            case "proc_analyzer.exe":
            case "sysAnalyzer.exe":
            case "sniff_hit.exe":
            case "windbg.exe":
            case "joeboxcontrol.exe":
            case "Fiddler.exe":
            case "joeboxserver.exe":
            case "ida64.exe":
            case "ida.exe":
            case "idaq64.exe":
            case "Vmtoolsd.exe":
            case "Vmwaretrat.exe":
            case "Vmwareuser.exe":
            case "Vmacthlp.exe":
            case "vboxservice.exe":
            case "vboxtray.exe":
            case "ReClass.NET.exe":
            case "x64dbg.exe":
            case "OLLYDBG.exe":
            case "Cheat Engine.exe":
            case "cheatengine-x86_64-SSE4-AVX2.exe":
            case "MugenJinFuu-i386.exe":
            case "Mugen JinFuu.exe":
            case "MugenJinFuu-x86_64-SSE4-AVX2.exe":
            case "MugenJinFuu-x86_64.exe":
            case "KsDumper.exe":
            case "dnSpy.exe":
            case "cheatenginei386.exe":
            case "cheatenginex86_64.exe":
            case "Fiddler Everywhere.exe":
            case "HTTPDebuggerSvc.exe":
            case "Fiddler.WebUi.exe":
            case "createdump.exe":
            case "twistedlulu-x86_64-SSE4-AVX2.exe":
            case "twistedlulu-x86_64.exe":
            case "twistedlulu-i386.exe":
            case "Beamer x96.exe":
            case "Beamer x64.exe":
            case "Beamer x32.exe":
            case "Extreme Dumper x64.exe":
            case "Extreme Dumper x32.exe":
            case "x64.exe":
            case "x32.exe":
            case "exit.exe":
            case "street.exe":
            case "street":
            case "exitcorp.exe":
                return { status: true, name: szExeFile, isCracker: true };
        };
    }).filter(e => e.status);

    return result.length > 0 ? result.at(0) : { status: false };
};

module.exports.InjectFile = (pid, path) => {
    const { handle } = jQFast.openProcess(pid);
    return new Promise(resolve => { try { jQFast.injectDll(handle, path); setTimeout(() => resolve(true), 800); } catch { resolve(false); } });
};

module.exports.UnloadFile = (pid, module) => {
    const { handle } = jQFast.openProcess(pid);
    return new Promise(resolve => { try { jQFast.unloadDll(handle, module); setTimeout(() => resolve(true), 800); } catch { resolve(false); } });
};


const FindInGame = async (handle, scanValue) => new Promise(resolve =>
    jQFast.fastFindPattern(handle, scanValue.split(" ").map(i => i !== "??" ? i : "?").join(" "), resolve));

module.exports.AsyncFindValues = (pid, scanValue) => new Promise((resolve, reject) => {
    const { length } = scanValue.split(" "), { handle } = jQFast.openProcess(pid); FindInGame(handle, scanValue).then(async address => {
        address = await Promise.all(address
            .map(async address => ({ address, currentValue: jQFast.readBuffer(handle, address, length) })));

        resolve(address);
    }).catch(reject);
});


module.exports.InjectValues = (pid, addresses, replaceValue, repValue) => new Promise(resolve => {
    const { handle } = jQFast.openProcess(pid);

    if (!repValue && !Array.isArray(replaceValue))
        return resolve(addresses.forEach(address => jQFast.writeBuffer(handle, address, replaceValue)));

    else if (!repValue && Array.isArray(replaceValue))
        return resolve(addresses.forEach((address, i) => jQFast.writeBuffer(handle, address, replaceValue[i])));


    else
        return resolve((() => new Promise(resolve => jQFast.InjectAimBot(handle, addresses, Number(replaceValue), Number(repValue), resolve)))());
});


module.exports.globalShortcut = new (require("events").EventEmitter)();
const keysDown = new Set(), keysPress = {}; jQFast.initEvent(async (name, code, method) => {
    if (method === 256 && keysDown.has(code))
        return null;

    if (method === 257 && keysDown.has(code))
        keysDown.delete(code);


    if (method === 256) {
        keysDown.add(code);
        keysPress[code] = (new Date()).getTime();
    };


    if (method === 257)
        method = "UP";
    else
        method = "DOWN";

    if (name == "Invalid Key")
        return null;

    switch (code) {
        case 35:
            name = "End"; break;

        case 36:
            name = "Home"; break;

        case 45:
            name = "Insert"; break;

        case 33:
            name = "Page Up"; break;

        case 34:
            name = "Page Down"; break;

        case 46:
            name = "Delete"; break;

        case 38:
            name = "Arrow Up"; break;

        case 40:
            name = "Arrow Down"; break;

        case 37:
            name = "Arrow Left"; break;

        case 39:
            name = "Arrow Right"; break;

        case 110:
            name = "Num ."; break;

        case 163:
            name = "Right Ctrl"; break;

        case 165:
            name = "Right Alt"; break;
    };

    if (typeof name === "number")
        return;

    module.exports
        .globalShortcut.emit(method.toLocaleLowerCase(), { code, name });
    module.exports.globalShortcut.emit(`${method.toLocaleLowerCase()}-${name}`);
    module.exports.globalShortcut.emit(`${method.toLocaleLowerCase()}-${code}`);

    if (method == "UP") {
        if (((new Date()).getTime() - keysPress[code]) < 800) {
            module.exports
                .globalShortcut.emit("press", { code, name });
            module.exports.globalShortcut.emit(`press-${name}`);
            module.exports.globalShortcut.emit(`press-${code}`);
        };
    };
});
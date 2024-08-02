const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const axios = require("axios").default;

const { version } = require("../../package.json"),
    { ipcRenderer, contextBridge } = require("electron"), jMemory = require("memoryjs");


const host = "localhost:8080", GetUserAgent = () => {
    const cpu = os.cpus().at(0).model;
    const token = Buffer.from(`(${cpu}*${os.availableParallelism()}) with ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB on ${os.type()}@${os.version()}`).toString("ascii");

    return Buffer.from(token.split().reverse().join()).toString("base64url");
};

contextBridge.exposeInMainWorld("SetPageSize", page => ipcRenderer.invoke("SetSize", ...(page === 'Login' ? [380, 500] : [1100, 580])));

contextBridge.exposeInMainWorld("GetEmulator", () => {
    try {
        const running_tasks = jMemory.getProcesses()
            .filter(({ szExeFile }) => ['HD-Player.exe', 'LdVBoxHeadless.exe', 'MEmuHeadless.exe', 'NoxVMHandle.exe'].includes(szExeFile));

        if (running_tasks.length > 0)
            return running_tasks.at(0).th32ProcessID;

        else
            return false;
    } catch { return false; };
});

contextBridge.exposeInMainWorld("Emulator", pid => {
    try {
        const process = jMemory.openProcess(pid);
        return { status: true, pid, handle: process.handle };
    } catch { return { status: false }; };
});

contextBridge.exposeInMainWorld("GetLogin", async (user, pass) => {
    try {
        const { data } = await axios.get(`http://${host}/api/login?user=${user}&pass=${pass}`, {
            headers: {
                "x-version": version,
                "x-user-agent": GetUserAgent()
            }
        });

        return data;
    } catch { return { status: false, msg: "Our servers are not responding. Please try again later." }; };
});


contextBridge.exposeInMainWorld("__InjectMenu__", (name, visual, handle, token) => new Promise(async resolve => {
    const __url = path.join(os.tmpdir(), `${Buffer.from(`${name}+${version}`).toString('base64url')}.dll`);

    if (!fs.existsSync(__url)) {
        try {
            const res = await fetch(`http://${host}/api/cheat/menu/${token}/${name}`);
            if (res.ok) {
                fs.writeFileSync(__url, Buffer.from(await res.arrayBuffer())); jMemory
                    .injectDll(handle, __url, (err, status) => setTimeout(() => resolve({ status: true, data: err.length == 0 && status }), 1000));
            } else
                resolve(await res.json());
        } catch (err) { console.log(err); resolve({ status: false, data: `Failed to download ${visual} dll file.` }); };
    } else {
        try {
            jMemory
                .injectDll(handle, __url, (err, status) => setTimeout(() => resolve({ status: true, data: err.length == 0 && status }), 1000));
        } catch { resolve({ status: false, msg: `Failed to inject ${visual}. Try again or check if your emulator is running in 32-Bit.` }); };
    };
}));


const skipWarnCode = new Set(), scanValues = (value, handle) => {
    const i = value
        .split(' ').map(i => i != '??' ? i : '?'); value = i.join(' ');


    const addresses = [];
    (function scanValue(e) {
        jMemory.findPattern(handle, value, jMemory.SUBTRACT, 0, (err, address) => {
            if (err?.length == 0 && address != 0) {
                console.log(address);
                addresses.push(address);
                // scanValue(address + i.length + 1);
            } else
                console.log(addresses);
        });
    })(0);
};

contextBridge.exposeInMainWorld("scanValues", scanValues);

contextBridge.exposeInMainWorld("__InjectCheat__", (name, visual, handle, token) => new Promise(async resolve => {
    const res = await fetch(`http://${host}/api/cheat/code/${token}/${name}`); if (res.ok) {
        const data = await res.json(); if (data.status) {
            if (data.data.length === 2) {
                if (data.data.at(0) || skipWarnCode.has(name)) {
                    skipWarnCode.delete(name);

                    const codes = data.data.at(1); try {
                        let totalReplaced = 0;
                        const values = await Promise.all(codes.map(([scanValue, replaceValue]) => new Promise(resolve => {
                            (async function scanAndReplace() {
                                try {
                                    const address = jMemory.findPattern(handle, scanValue.split(' ').map(e => e == '??' ? '?' : e).join(' '), jMemory.NORMAL, 0);
                                    try {
                                        console.log(jMemory.writeBuffer(handle, address, Buffer.from(replaceValue.split(" ").map(e => Number(`0x${e}`)))));

                                        scanAndReplace();
                                    } catch { resolve(false); };
                                } catch { resolve(false); };
                            })();
                        })));

                        if (values.filter(e => !e).length > 0 && totalReplaced == 0)
                            resolve({ status: false, msg: `Failed to inject ${visual}. Cannot write memory values, check your emulator.` });
                        else
                            resolve({ status: true });
                    } catch (err) { console.log(err); resolve({ status: false, msg: `Failed to inject ${visual}.` }); };
                } else {
                    skipWarnCode
                        .add(name); resolve({ status: false, msg: `This feature is currently not safe to use. Still if you want to use it, Click again on inject.` });
                };
            } else
                resolve({ status: false, msg: `This feature is not yet complete. Ask the developer for more details.` });
        } else
            resolve({ status: false, msg: `${data.msg}` });
    } else
        resolve({ status: false, msg: `Failed to download latest codes from our server. Try again later.` });
}));
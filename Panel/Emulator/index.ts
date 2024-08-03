/// @ts-nocheck
const jQ = require(require("node:path").join(__dirname, "jQ.mem.node"));


export const OpenEmulator = (pid: number): boolean | number => {
    try { return jQ.openProcess(pid)?.handle || false; } catch { return false; };
};

export const FindEmulator = (): Array<{ pid: number, name: "Memu" | "BlueStacks" | "LD Player" | "Nox Player" }> => {
    return jQ.getProcesses().map(({ szExeFile, th32ProcessID }) => {
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
};


const FindValues = async (handle: number, scanValue: string): Promise<Array<number>> => new Promise(resolve => {
    jQ.findPattern(handle, scanValue.split(" ").replace(i => i !== "??" ? i : "?").join(" "), jQ.NORMAL, 0, async (err, results) => {
        if (err.length > 0 || results.length == 0)
            resolve([]);

        else
            resolve(results);
    });
});


import os from "node:os";
import fs from "node:fs";
import { join } from "node:path";
import { version } from "../package.json";

const InjectFile = (handle: number, path: string): Promise<boolean> =>
    new Promise(resolve => { try { setTimeout(() => resolve(jQ.injectDll(handle, path)), 3000); } catch { resolve(false); } }),

    InjectValues = (handle: number, scanValue: string, replaceValue: string, store: boolean): Promise<boolean | Array<{ address: number, value: Buffer }>> => new Promise(async resolve => {
        replaceValue = Buffer.from(replaceValue.split(" ").map(i => Number(`0x${i}`)));

        const address = await FindValues(handle, scanValue); if (address.length > 0) {
            if (store) {
                const size = scanValue.split(" ").length;
                const currentValues: Array<Buffer> = await Promise.all(address.map(async address => jQ.readBuffer(handle, address, size)));

                (await Promise.all(address.map(address =>
                    jQ.writeBuffer(handle, address, replaceValue)))).filter(i => !i).length == 0;

                resolve(address.map((address, i)
                    => { return { address, value: currentValues[i] }; }));
            } else
                resolve((await Promise.all(address.map(address =>
                    jQ.writeBuffer(handle, address, replaceValue)))).filter(i => !i).length == 0);
        } else
            resolve(false);
    });


const host = "20.197.23.225:3000", skipWarn = new Set();
export const Inject = (name: string, visual: string, token: string, handle: number): Promise<{ status: boolean, err: string }> => new Promise(async resolve => {
    if (name.startsWith("[CHAMS]")) {
        const path = join(os.tmpdir(),
            Buffer.from(`Mistero@${version}`).toString("base64url"), Buffer.from(`${name.slice(7)}@${version}`).toString("base64url"));

        if (fs.existsSync(path))
            (await InjectFile(handle, path)) ? resolve({ status: true }) : resolve({ status: false, err: `Failed to inject ${visual}. [EMULATOR_ERROR]` });

        else
            fetch(`http://${host}/api/cheat/menu/${token}/${name}`).then(async res => {
                if (res.ok) {
                    try {
                        await Bun.write(path, res, { createPath: true });

                        (await InjectFile(handle, path)) ? resolve({ status: true }) : resolve({ status: false, err: `Failed to inject ${visual}. [EMULATOR_ERROR]` });
                    } catch { resolve({ status: false, err: `Failed to inject ${visual}. [FILE_ERROR]` }); };
                } else
                    resolve({ status: false, err: (await res.json()).msg });
            }).catch(() => resolve({ status: false, err: `Failed to inject ${visual}. [FAILED_DOWNLOAD]` }));
    } else if (name.startsWith("[CHEAT]"))
        fetch(`http://${host}/api/cheat/code/${token}/${name.slice(7)}`).then(async res => {
            if (res.ok) {
                const data = await res.json(); if (data.status) {
                    const [status, codes] = data; if (status) {
                        const __status = (await Promise.all(codes
                            .map(async ([scanValue, replaceValue]) => await InjectValues(handle, scanValue, replaceValue, false)))).filter(i => !i).length == 0;
                        if (__status)
                            resolve({ status: true });

                        else
                            resolve({ status: false, err: `Failed to inject ${visual}. [VALUE_NOT_FOUND]` });
                    } else
                        if (skipWarn.has(name)) {
                            const __status = (await Promise.all(codes
                                .map(async ([scanValue, replaceValue]) => await InjectValues(handle, scanValue, replaceValue, false)))).filter(i => !i).length == 0;
                            if (__status)
                                resolve({ status: true });

                            else
                                resolve({ status: false, err: `Failed to inject ${visual}. [VALUE_NOT_FOUND]` });
                        } else {
                            skipWarn.add(name);
                            resolve({ status: false, err: `${visual} is not currently not safe to use. Still want to use, Click again on inject.` });
                        };
                } else
                    resolve(data);
            } else
                resolve({ status: false, err: `Failed to inject ${visual}. [FAILED_DOWNLOAD]` });
        }).catch(() => resolve({ status: false, err: `Failed to inject ${visual}. [FAILED_DOWNLOAD]` }));
    else
        resolve({ status: false, err: "Invalid cheat injection." });
});
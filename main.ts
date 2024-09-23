import os from "node:os";
import path from "node:path";


await Promise.all(os.cpus().map(async () => (async function spawnServer() {
    return Bun.spawn({
        cmd: [process.execPath, path.join(__dirname, "index.ts")],
        stdin: "ignore", stdout: "inherit", stderr: "inherit", onExit: () => { setTimeout(() => spawnServer(), 1000); }, ipc: (message, subprocess) => {

        }
    });
})()));
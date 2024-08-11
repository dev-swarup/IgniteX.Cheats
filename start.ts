import os from "os"; for (let i = 0; i < os.availableParallelism(); i++)
    Bun.spawn({
        cmd: ["bun", "index.ts"],
        stdout: "inherit",
        windowsHide: true,
    });
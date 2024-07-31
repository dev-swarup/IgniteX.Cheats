module.exports = {
    apps: [
        {
            name: "MainServer",
            script: "./index.ts",
            interpreter: "~/.bun/bin/bun",

            instances: -1,
            exec_mode: "cluster",
            max_memory_restart: "300M"
        }
    ]
}
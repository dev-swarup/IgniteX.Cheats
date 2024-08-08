module.exports = {
    apps: [
        {
            name: "MainServer",
            script: "index.ts",
            interpreter: "bun",

            watch: true,
            instances: 1,
            exec_mode: "cluster",
            restart_delay: 10000,
            max_memory_restart: "300M"
        }
    ]
}
module.exports = {
    apps: [
        {
            name: "MainServer",
            script: __dirname + "/start.js",
            instances: require("os").availableParallelism(),

            exec_mode: "cluster"
        }
    ]
};
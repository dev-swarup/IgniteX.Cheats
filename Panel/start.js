const { execSync } = require("child_process");

(async () => {
    execSync("bytenode -c main.js -e -ep bluestacks.exe");
    execSync("bytenode -c ./jQ/index.js -e -ep bluestacks.exe");
    execSync("bytenode -c ./static/js/jQuery.Manager.js -e -ep bluestacks.exe");

    const proc = require("node:child_process")
        .execFile("bluestacks.exe", ["index.js"]); proc.stdout.pipe(process.stdout); proc.stderr.pipe(process.stderr);
})();
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { createPackage } = require("@electron/asar");

(async () => {
    execSync("bytenode -c main.js -e -ep bluestacks.exe");
    execSync("bytenode -c ./jQ/index.js -e -ep bluestacks.exe");
    execSync("bytenode -c ./static/js/jQuery.Manager.js -e -ep bluestacks.exe");

    if (fs.existsSync(path.join(__dirname, "dist")))
        fs.rmSync(path.join(__dirname, "dist"), { recursive: true });

    fs.mkdirSync(path.join(__dirname, "dist", "resources_temp", "node_modules"), { recursive: true });
    fs.cpSync(path.join(__dirname, "node_modules", "bytenode"), path.join(__dirname, "dist", "resources_temp", "node_modules", "bytenode"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, "dist", "resources_temp", "package.json"), JSON.stringify({
        main: "main.js",
        version: require("./package.json").version, dependencies: { bytenode: "^1.5.6" }
    }));

    fs.mkdirSync(path.join(__dirname, "dist", "resources_temp", "jQ"));
    [
        "mem.node",
        "index.jsc",
        "mem.scan.node",
    ]
        .map(url => fs.copyFileSync(path.join(__dirname, "jQ", url), path.join(__dirname, "dist", "resources_temp", "jQ", url)));

    fs.mkdirSync(path.join(__dirname, "dist", "resources_temp", "static", "js"), { recursive: true });
    [
        "index.html",
        "logo.png",
        "main.css",
        "CascadiaCode.TTF",
        "alert.wav",
        "logo.png",
        "js/jQuery.js",
        "js/jQuery.Manager.jsc"
    ]
        .map(url => fs.copyFileSync(path.join(__dirname, "static", url), path.join(__dirname, "dist", "resources_temp", "static", url)));
    fs.writeFileSync(path.join(__dirname, "dist", "resources_temp", "static", "js", "jQuery.Manager.js"), `require("bytenode"); require("./jQuery.Manager.jsc");`);

    fs.copyFileSync(path.join(__dirname, "main.jsc"), path.join(__dirname, "dist", "resources_temp", "main.jsc"));
    fs.writeFileSync(path.join(__dirname, "dist", "resources_temp", "main.js"), `require("bytenode"); require("./main.jsc");`);

    await createPackage(path.join(__dirname, "dist", "resources_temp"), path.join(__dirname, "dist", "app.asar"));

    fs.rmSync(path.join(__dirname, "dist", "resources_temp"), { recursive: true });
})();
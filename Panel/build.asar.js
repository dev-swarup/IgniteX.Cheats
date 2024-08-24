const fs = require("fs");
const path = require("path");
const resellers = require("../reseller.config.json");

const { execSync } = require("child_process");
const { createPackage } = require("@electron/asar");

(async () => {
    execSync("bytenode --compress -c main.js -e -ep bluestacks.exe");
    execSync("bytenode --compress -c ./jQ/index.js -e -ep bluestacks.exe");
    execSync("bytenode --compress -c ./static/js/jQuery.Manager.js -e -ep bluestacks.exe");

    if (fs.existsSync(path.join(__dirname, "dist")))
        fs.rmSync(path.join(__dirname, "dist"), { recursive: true });

    fs.mkdirSync(path.join(__dirname, "dist", "resources_temp", "node_modules"), { recursive: true });
    fs.cpSync(path.join(__dirname, "node_modules", "bytenode"), path.join(__dirname, "dist", "resources_temp", "node_modules", "bytenode"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, "dist", "resources_temp", "package.json"), JSON.stringify({
        main: "main.js",
        name: resellers.currentBuildFor,
        title: resellers[resellers.currentBuildFor].title,
        version: require("./package.json").version, dependencies: { bytenode: "^1.5.6" }
    }));

    fs.mkdirSync(path.join(__dirname, "dist", "resources_temp", "jQ"));
    [
        "mem.node",
        "index.jsc"
    ]
        .map(url => fs.copyFileSync(path.join(__dirname, "jQ", url), path.join(__dirname, "dist", "resources_temp", "jQ", url)));

    fs.mkdirSync(path.join(__dirname, "dist", "resources_temp", "static", "js"), { recursive: true });
    [
        "main.css",
        "index.html",
        "alert.wav",
        "js/jQuery.js",
        "CascadiaCode.TTF",
        "js/jQuery.Manager.jsc"
    ]
        .map(url => fs.copyFileSync(path.join(__dirname, "static", url), path.join(__dirname, "dist", "resources_temp", "static", url)));
    fs.copyFileSync(path.join(__dirname, "static", "icons", `${resellers.currentBuildFor}.png`), path.join(__dirname, "dist", "resources_temp", "static", "logo.png"));
    fs.writeFileSync(path.join(__dirname, "dist", "resources_temp", "static", "js", "jQuery.Manager.js"), `require("bytenode"); require("./jQuery.Manager.jsc");`);

    fs.copyFileSync(path.join(__dirname, "main.jsc"), path.join(__dirname, "dist", "resources_temp", "main.jsc"));
    fs.writeFileSync(path.join(__dirname, "dist", "resources_temp", "main.js"), `require("bytenode"); require("./main.jsc");`);

    fs.mkdirSync(path.join(__dirname, "dist", "resources_temp", "jQMenu"));
    [
        "3D.dll",
        "BOX.dll",
        "MENU.dll",
        "MOCO.dll",
        "COLOR[RED].dll",
        "COLOR[BLUE].dll",
        "COLOR[WHITE].dll",
    ]
        .map(url => fs.copyFileSync(path.join(__dirname, "..", "Assets", "LocationMenu", url), path.join(__dirname, "dist", "resources_temp", "jQMenu", url)));


    await createPackage(path.join(__dirname, "dist", "resources_temp"), path.join(__dirname, "dist", "app.asar"));
})();
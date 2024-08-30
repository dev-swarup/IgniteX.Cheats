const fs = require("fs");
const path = require("path");
const resellers = require("../reseller.config.json");
const { obfuscate } = require("javascript-obfuscator");

const { execSync } = require("child_process"),
    { createPackage } = require("@electron/asar"), { version } = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));

const isPackaged = process.argv.includes("--build");

(async () => {
    if (fs.existsSync(path.join(__dirname, "dist")))
        fs.rmSync(path.join(__dirname, "dist"), { recursive: true });
    fs.mkdirSync(path.join(__dirname, "dist", "resources_temp", "node_modules"), { recursive: true });

    await Promise.all([
        (async () => {
            let startApp = `const host = "${isPackaged ? "20.197.23.225:3000" : "localhost:8080"}", name = "${resellers.currentBuildFor}", version = "${version}", isPackaged = ${isPackaged};\n${fs.readFileSync(path.join(__dirname, "index.js"), "utf-8")}`;

            fs.writeFileSync(path.join(__dirname, "dist", "index.js"), obfuscate(startApp, { compact: false, deadCodeInjection: true }).getObfuscatedCode());
        })(),

        (async () => {
            let mainApp = fs.readFileSync(path.join(__dirname, "main.js"), "utf-8");
            let mainLoadApp = fs.readFileSync(path.join(__dirname, "static", "js", "jQuery.Manager.js"), "utf-8");

            let jQMenu = {};["3D", "BOX", "MOCO", "COLOR[RED]", "COLOR[BLUE]", "COLOR[WHITE]"]
                .forEach(name => jQMenu[name] = fs.readFileSync(path.join(__dirname, "..", "Assets", "LocationMenu", `${name}.dll`), "base64"));

            const [alert, index, main_css, cascadia_code] = ["alert.wav", "index.html", "main.css", "CascadiaCode.TTF"].map(file => Buffer.from(fs.readFileSync(path.join(__dirname, "static", file)), "utf8").toString("base64")),

                logo = Buffer.from(fs.readFileSync(path.join(__dirname, "static", "icons", `${resellers.currentBuildFor}.png`))).toString("base64");

            fs.writeFileSync(path.join(__dirname, "dist", "main.js"), obfuscate(`const os = require("os");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { app, BrowserWindow, ipcMain, ipcRenderer, dialog, contextBridge } = require("electron");\n\n            
const host = "${isPackaged ? "20.197.23.225:3000" : "localhost:8080"}", devTools = ${!isPackaged ? true : false};        
const name = "${resellers.currentBuildFor}", title = "${resellers[resellers.currentBuildFor].title}", version = "${version}", jQMenu = ${JSON.stringify(jQMenu)};\n\n
${fs.readFileSync(path.join(__dirname, "jQ", "index.js"))}\nif("window" in global && "document" in global)\n(async () => {\n${`const logo = "${logo}", alert_wav="${alert}", index = "${index}", main_css = "${main_css}", cascadia_code = "${cascadia_code}";\n${mainLoadApp}`}\n})();\nelse {\n(async () => {\n${mainApp}\n})();\n};`, { compact: false, deadCodeInjection: true }).getObfuscatedCode());

            execSync("bytenode --compress -c dist/main.js -e -ep bluestacks.exe");
        })()
    ]);

    fs.copyFileSync(path.join(__dirname, "dist", "main.jsc"), path.join(__dirname, "dist", "resources_temp", "main.jsc"));
    fs.copyFileSync(path.join(__dirname, "static", "js", "jQuery.js"), path.join(__dirname, "dist", "resources_temp", "jQuery.js"));

    fs.mkdirSync(path.join(__dirname, "dist", "node_modules"));
    [
        "axios",
        "mime-db",
        "asynckit",
        "bytenode",
        "form-data",
        "mime-types",
        "node-unrar-js",
        "proxy-from-env",
        "delayed-stream",
        "combined-stream",
        "follow-redirects",
    ]

        .forEach(module => fs.cpSync(path.join(__dirname, "node_modules", module), path.join(__dirname, "dist", "node_modules", module), { recursive: true }));
    fs.cpSync(path.join(__dirname, "node_modules", "bytenode"), path.join(__dirname, "dist", "resources_temp", "node_modules", "bytenode"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, "dist", "package.json"), JSON.stringify({
        version, name: resellers.currentBuildFor,

        bin: "index.js",
        main: "index.js",
        pkg: {
            assets: [
                "app.asar",
                "node_modules/**/*"
            ],
            targets: [
                "node18-win-x64"
            ]
        }
    }));

    fs.writeFileSync(path.join(__dirname, "dist", "resources_temp", "package.json"), JSON.stringify({ main: "main.js" }));
    fs.writeFileSync(path.join(__dirname, "dist", "resources_temp", "main.js"), `require("bytenode");\nrequire("./main.jsc");`);
    await createPackage(path.join(__dirname, "dist", "resources_temp"), path.join(__dirname, "dist", "app.asar"));
})();
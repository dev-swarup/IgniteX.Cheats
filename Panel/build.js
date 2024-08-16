const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

let resellers_data = require("../reseller.config.json"); const
    { currentBuildFor } = resellers_data; delete resellers_data.currentBuildFor;


Object.keys(resellers_data).forEach(async reseller => {
    fs.writeFileSync(path.join(__dirname, "..", "reseller.config.json"), JSON.stringify({
        ...resellers_data, ...{
            currentBuildFor: reseller
        }
    }));

    const log = execSync(`npm run build:tailwindcss && node build.asar.js && pkg -C GZip -o dist/${reseller}.exe .`); if (fs.existsSync(path.join(__dirname, "dist", `${reseller}.exe`))) {
        fs.copyFileSync(path.join(__dirname, "dist", `${reseller}.exe`), path.join(__dirname, "dist_exe", `${reseller}.exe`));

        console.log(`Build for ${reseller} done.`);
    } else
        console.log(`Failed Build for ${reseller}`, log);
});

fs.writeFileSync(path.join(__dirname, "..", "reseller.config.json"), JSON.stringify({ ...resellers_data, ...{ currentBuildFor } }));
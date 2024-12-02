const colors = require('tailwindcss/colors');
const plugin = require('tailwindcss/plugin');
const resellers = require("../reseller.config.json");

module.exports = {
    content: [
        "static/*.css",
        "static/index.html"
    ],
    theme: {
        colors: {
            ...colors, ...{
                color: colors[resellers[resellers.currentBuildFor].theme]
            }
        }
    },
    plugins: [
        plugin(function ({ addBase }) {
            addBase({ "@font-face": { "font-family": "Cascadia", "src": `url("data:font/truetype;charset=utf-8;base64,${require("fs").readFileSync(require("path").join(__dirname, "static", "CascadiaCode.TTF"), "base64")}")` } })
        }),
    ]
};
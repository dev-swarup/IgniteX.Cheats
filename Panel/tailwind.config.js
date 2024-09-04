const colors = require('tailwindcss/colors');
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
    }
};
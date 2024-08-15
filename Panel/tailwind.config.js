const colors = require('tailwindcss/colors');

module.exports = {
    content: [
        "static/main.css",
        "static/index.html"
    ],
    theme: {
        colors: {
            ...colors, ...{
                color: colors.violet
            }
        }
    },
    plugins: [],
};
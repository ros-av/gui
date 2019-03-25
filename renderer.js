require("babel-register")({
    plugins: ["transform-es2015-modules-commonjs"],
    presets: [
        "react",
        "stage-0",
        "env"
    ]
})

module.exports = require("./app.js")

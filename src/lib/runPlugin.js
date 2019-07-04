import Promise from "bluebird"

import fs from "../utils/fs"

import runFile from "./runFile"

export default (dir) => new Promise((resolve, reject) => {
    // Get path stats
    fs.stat(dir)
        .then((stats) => {
            // Get path extension
            const ext = dir.split(".")[0]

            // If path is directory run index.js file inside of the directory
            if (stats.isDirectory()) runFile(path.join(dir, "index.js")).then(resolve).catch(reject)

            // If extension is JS run it
            else if (ext === "js") runFile(dir).then(resolve).catch(reject)

            // If extension is CSS run it
            else if (ext === "css") {
                $("head").append(`<link rel="stylesheet" href="${dir}">`)
                resolve()
            }

            // If unknown reject
            else reject(new TypeError("Only JS files, directories with JS files and CSS file allowed!"))
        })
        .catch((err) => reject(err))
})

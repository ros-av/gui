import Promise from "bluebird"

import fs from "../utils/fs"

export default (dir) => new Promise((resolve, reject) => {
    // Read the file contents
    fs.readFile(dir)
        .then((contents) => {
            try {
                // Self containing function
                (() => {
                    // Evaluate contents
                    eval(contents)
                })()
            } catch (err) {
                reject(err)
            }
            resolve()
        })
        .catch((err) => reject(err))
})

import Promise from "bluebird"

import md5file from "md5-file"

import fs from "../utils/fs"

import path from "path"

export default (dir, hashes) => new Promise((resolve, reject) => {
    fs.lstat(path.resolve(dir))
        .then((stats) => {
            // If path is a directory
            if (stats.isDirectory()) {
                resolve({
                    safe: true,
                })
            }
            // Get the MD5 of a file
            md5file(path.resolve(dir), (err, hash) => {
                if (err) reject(err)
                // If the hash is in the list
                resolve({
                    safe: !hashes.mightContain(hash),
                })
            })
        })
        .catch((err) => reject(err))
})

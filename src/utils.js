// Improved promises
import Promise from "bluebird"

// Improved filesystem functions
const fs = require("graceful-fs").gracefulify(require("fs"))

// Path manager
import path from "path"

// Get first line of file
import firstline from "firstline"

// Bloom filter
import {
    BloomFilter,
} from "bloomfilter"

// MD5 File
import md5file from "md5-file"

// LZString
import lzjs from "lzjs"

export function populateDirectory(dir) {
    return new Promise((resolve, reject) =>
        fs.access(dir, fs.constants.F_OK, (err) => {
            if (err) {
                fs.mkdir(dir, {
                    recursive: true,
                }, (err) => {
                    if (err) reject(err)
                    resolve(true)
                })
            } else resolve(false)
        })
    )
}

// Hashes loader
export function loadHashes(hashes, hashesparams) {
    return new Promise((resolve) =>
        Promise.all([firstline(hashesparams), firstline(hashes)]).then((val) =>
            resolve(new BloomFilter(JSON.parse(lzjs.decompress(val[1])), parseInt(val[0])))
        )
    )
}

export function safe(dir, hashes) {
    return new Promise((resolve, reject) => {
        fs.lstat(path.resolve(dir), (err, stats) => {
            if (err) reject(err)
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
    })
}

import {version} from "../package.json"
const userAgent = `ROS AV ${version}`

const request = require("request").defaults({
    gzip: true,
    method: "GET",
    headers: {
        "User-Agent": userAgent,
    },
})

export {request}

export const githubapi = request.defaults({
    json: true,
    headers: {
        "Accept": "application/vnd.github.v3+json",
    },
})

export function bestForBloom(n, p) {
    const m = Math.ceil((n * Math.log(p)) / Math.log(1 / (2 ** Math.log(2))))
    const k = Math.round((m / n) * Math.log(2))
    return {
        m,
        k,
    }
}

export default {populateDirectory, loadHashes, safe, request, githubapi, bestForBloom}

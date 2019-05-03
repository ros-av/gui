// Improved promises
const Promise = require("bluebird");

// Improved filesystem functions
const fs = require("graceful-fs").gracefulify(require("fs"))

// Path manager
import * as path from "path"

// Get first line of file
import * as firstline from "firstline"

// Bloom filter
import * as BloomFilter from "bloomfilter"

// MD5 File
import * as md5file from "md5-file"

// LZString
import * as lzjs from "lzjs"

const populateDirectory = (dir) => new Promise((resolve, reject) =>
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

// Hashes loader
const loadHashes = (hashes, hashesparams) => new Promise((resolve) =>
    Promise.all([firstline(hashesparams), firstline(hashes)]).then((val) =>
        resolve(new BloomFilter(JSON.parse(lzjs.decompress(val[1])), parseInt(val[0])))
    )
)

const safe = (dir, hashes) => new Promise((resolve, reject) => {
    fs.lstat(path.resolve(dir), (err, stats) => {
        if (err) reject(err)
        // If path is a directory
        if (stats.isDirectory()) resolve({safe: true})
        // Get the MD5 of a file
        md5file(path.resolve(dir), (err, hash) => {
            if (err) reject(err)
            // If the hash is in the list
            resolve({safe: !hashes.mightContain(hash)})
        })
    })
})

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.108 Safari/537.36"

const request = require("request").defaults({
    gzip: true,
    method: "GET",
    headers: {
        "User-Agent": userAgent,
    },
})

const githubapi = request.defaults({
    json: true,
    headers: {
        "Accept": "application/vnd.github.v3+json",
    },
})

const countFileLines = filePath => new Promise((resolve, reject) => {
    let lineCount = 0
    fs.createReadStream(filePath)
        .on("data", (buffer) => {
            let idx = -1
            lineCount--
            do {
                idx = buffer.indexOf(10, idx + 1)
                lineCount++
            } while (idx !== -1)
        })
        .on("end", () => resolve(lineCount))
        .on("error", reject())
})

const bestForBloom = (n, p) => {
    const m = Math.ceil((n * Math.log(p)) / Math.log(1 / (2 ** Math.log(2))))
    const k = Math.round((m / n) * Math.log(2))
    return {
        m: m,
        k: k
    }
}

export default {
    populateDirectory,
    loadHashes,
    safe,
    userAgent,
    request,
    githubapi,
    countFileLines,
    bestForBloom,
}

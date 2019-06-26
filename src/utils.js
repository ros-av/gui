// Improved promises
const Promise = require("bluebird")

// Improved filesystem functions
const fs = require("graceful-fs").gracefulify(require("fs"))

// Path manager
const path = require("path")

// Get first line of file
const firstline = require("firstline")

// Bloom filter
const {
    BloomFilter
} = require("bloomfilter")

// MD5 File
const md5file = require("md5-file")

// LZString
const lzjs = require("lzjs")

exports.populateDirectory = (dir) => new Promise((resolve, reject) =>
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
exports.loadHashes = (hashes, hashesparams) => new Promise((resolve) =>
    Promise.all([firstline(hashesparams), firstline(hashes)]).then((val) =>
        resolve(new BloomFilter(JSON.parse(lzjs.decompress(val[1])), parseInt(val[0])))
    )
)

const safe = (dir, hashes) => new Promise((resolve, reject) => {
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

const version = require("../package.json").version
const userAgent = `ROS AV ${version}`

const request = require("request").defaults({
    gzip: true,
    method: "GET",
    headers: {
        "User-Agent": userAgent,
    },
})

exports.request = request

exports.githubapi = request.defaults({
    json: true,
    headers: {
        "Accept": "application/vnd.github.v3+json",
    },
})

exports.bestForBloom = (n, p) => {
    const m = Math.ceil((n * Math.log(p)) / Math.log(1 / (2 ** Math.log(2))))
    const k = Math.round((m / n) * Math.log(2))
    return {
        m,
        k,
    }
}

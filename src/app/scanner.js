const files = {
    hashlist: path.join(dirs.storedir, "scanning", "hashlist.lzstring.json"), // Hashlist file
    lastmodified: path.join(dirs.storedir, "scanning", "lastmodified.txt"), // Last modified file
    hashesparams: path.join(dirs.storedir, "scanning", "hashesparams.txt"), // Hashlist parameters file
    hashtxt: path.join(dirs.tempdir, "hashlist.txt"), // Temporary hashlist file
}

let hashes

import countFileLines from "../utils/countFileLiness"

import LineByLineReader from "line-by-line"

import {
    EventEmitter,
} from "events"

import rprog from "request-progress"

// Bloom filter
import {
    BloomFilter,
} from "bloomfilter"

import * as lzjs from "lzjs"

import dayjs from "dayjs"

import fs from "../utils/fs"

import safe from "../lib/safe"

import github from "../utils/github"

import request from "../utils/request"

import bestForBloom from "../utils/bestForBloom"

import loadHashes from "../lib/loadHashes"

import snackBarMessage from "./snackBarMessage"

const update = (hashlist, hashesparams, lastmodified, temphashes) => {
    const self = new EventEmitter()

    // Download latest commit date of hash list
    github.repos.getContents({
        owner: "Richienb",
        repo: "virusshare-hashes",
        path: "/",
    })
        .then(({commit}) => {
            if (isJSON(commit)) fs.writeFile(lastmodified, commit.author.date)
        })
        .catch((err) => self.emit("error", err))

    // Download hashlist
    rprog(request("https://media.githubusercontent.com/media/Richienb/virusshare-hashes/master/virushashes.txt"))
        .on("error", (err) => self.emit("error", err))
        .on("progress", ({
            size,
        }) => self.emit("progress", {
            done: size.transferred / size.total / 2,
            total: 1.0,
        }))
        .on("end", () => countFileLines(temphashes).then((lines) => {
            const bestFilter = bestForBloom(
                lines, // Number of bits to allocate
                1e-10, // Number of hash functions (currently set at 1/1 billion)
            )

            const hashes = new BloomFilter(
                bestFilter.m,
                bestFilter.k,
            )

            let done = 0

            // Line reader
            const hlr = new LineByLineReader(temphashes, {
                encoding: "utf8",
                skipEmptyLines: true,
            })

            // Line reader error
            hlr.on("error", (err) => self.emit("error", err))

            // New line from line reader
            hlr.on("line", (line) => {
                hashes.add(line)
                done++
                self.emit("progress", {
                    done: done / lines + 0.5,
                    total: 1.0,
                })
            })

            // Line reader finished
            hlr.on("end", () =>
                fs.writeFile(hashlist, lzjs.compress(JSON.stringify([].slice.call(hashes.buckets)))))
                .then(() => fs.writeFile(hashesparams, bestFilter.k.toString(), () => self.emit("end")))
                .catch((err) => reject(err))
        }).catch((err) => self.emit("progress", err)))
        .pipe(fs.createWriteStream(temphashes))
    return self
}

const checkupdate = (hashlist, lastmodified) => new Promise((resolve, reject) => {
    fs.pathExists(hashlist)
        .then((exists) => {
            if (!err) {
                return resolve({
                    fileexists: false,
                    outofdate: true,
                })
            }
            github.rateLimit.get().then(({
                resources,
            }) => {
                // Check the quota limit
                if (resources.core.remaining === 0) {
                    // If no API quota remaining
                    resolve({
                        quota: false,
                        fileexists: true,
                        reset: resources.core.reset,
                        outofdate: false,
                    })
                } else {
                    // Check for the latest commit
                    github.repos.listCommits({
                        owner: "Richienb",
                        repo: "virusshare-hashes",
                    })
                        .then(({commit}) => {
                            // Get download date of hashlist
                            const saved = dayjs(lastmodified)

                            // Get latest commit date of hashlist
                            const latest = dayjs(commit.author.date, "YYYY-MM-DDTHH:MM:SSZ")

                            // Check if the saved version is older than the latest
                            resolve({
                                quota: true,
                                fileexists: true,
                                reset: resources.core.reset,
                                outofdate: saved.isBefore(latest),
                            })
                        })
                        .catch((err) => reject(err))
                }
            })
                .catch((err) => reject(err))
        })
        .catch((err) => reject(err))
})

const scan = (dir, action) => new Promise((resolve, reject) => {
    // Check if file is safe
    safe(dir, hashes).then(({
        safe,
    }) => {
        if (!safe) {
            if (action === "remove") {
                // Delete the file
                fs.remove(file)
                    .then(() => {
                        snackBarMessage(`${file} was identified as a threat and was deleted.`, 0.1)
                        resolve({
                            safe: false,
                        })
                    })
                    .catch((err) => reject(err))
            } else if (action === "quarantine") {
                fs.rename(file, path.resolve(args.data, "quarantine", path.basename(file)))
                    .then(() => {
                        snackBarMessage(`${file} was identified as a threat and was quarantined.`, 0.1)
                        resolve({
                            safe: false,
                        })
                    })
                    .catch((err) => reject(err))
            } else {
                resolve({
                    safe: false,
                })
            }
        } else {
            resolve({
                safe: true,
            })
        }
    }).catch((e) => reject(e))
})

// Check for updates
checkupdate(files.hashlist, files.lastmodified).then(({
    outofdate,
}) => {
    // If not out of date load hashes
    if (!outofdate) {
        loadHashes(files.hashlist, files.hashesparams).then((o) => {
            hashes = o
            hashesLoaded = true
            $(".app--progress").get(0).MDCLinearProgress.close()
        })
    }

    // If out of date update hashes
    else {
        // Make progress bar determinate
        $(".app--progress").get(0).MDCLinearProgress.determinate = true
        const u = update(files.hashlist, files.hashesparams, files.lastmodified, files.hashtxt)
        // When progress occurred
        u.on("progress", ({
            done,
            total,
        }) => {
            // Make progress bar determinate
            document.querySelector(".app--progress").MDCLinearProgress.progress = done / total
        })
        // When complete
        u.on("end", () => {
            // Load hashes
            loadHashes(files.hashlist, files.hashesparams).then((o) => {
                hashes = o
                hashesLoaded = true
                $(".app--progress").get(0).MDCLinearProgress.close()
            })
        })
    }
})

export default scan

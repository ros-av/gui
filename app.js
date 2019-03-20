// Path functions
import path from "path"

// Define Vue app
const app = new Vue({
    el: ".app",
    data: {
        activeTab: "dashboard"
    },
    methods: {
        isActiveTab(tabId) {
            return this.activeTab === tabId
        },
        setActiveTab(tabId) {
            this.activeTab = tabId
        }
    }
})

// Provide improved filesystem functions
import _realFs from "fs"
import _gracefulFs from "graceful-fs"
_gracefulFs.gracefulify(_realFs)
import fs from "graceful-fs"

// Notifications service
import notifier from "node-notifier"

// Attach snackbar
const snackbar = new mdc.snackbar.MDCSnackbar($(".main--snackbar").get(0))

// Display snackbar message
const snackBarMessage = (message, volume = 0.0) => {
    snackbar.close()
    snackbar.labelText = message
    snackbar.open()
    notifier.notify({
        title: "ROS AV",
        message,
        icon: path.join(__dirname, "icon.ico"),
        sound: false
    })
    $(".ping").get(0).volume = volume
    $(".ping").get(0).play()
}

const populateDirectory = (dir) => {
    fs.access(dir, (err) => {
        if (err) {
            fs.mkdir(dir, {
                recursive: true
            }, (err) => {
                if (err) snackBarMessage(`Unable to create application directories. (${err})`)
            })
        }
    })
}

// Define storage path
const storage = path.join(require("temp-dir"), "rosav")

// New storage path (not ready to migrate yet)
// const storage = require("app-cache-dir")("rosav")

populateDirectory(storage)
populateDirectory(path.join(storage, "scanning"))
populateDirectory(path.join(storage, "quarantine"))
populateDirectory(path.join(storage, "reports"))
populateDirectory(path.join(storage, "plugins"))

// Settings storage
import db from "node-persist"

// Initialise storage
db.init({
    dir: path.join(storage, "db")
})

import $ from "jquery"

mdc.autoInit()

// Intialise MDC list
const list = mdc.list.MDCList.attachTo($(".main--drawer-content").get(0))

// Fix focusing
list.wrapFocus = true

// For each icon button with ripples
$(".mdc-icon-button[data-mdc-auto-init='MDCRipple']").each((_, {
    MDCRipple
}) => {
    // Fix ripples
    MDCRipple.unbounded = true
})

// Bloom filter functionality
import {
    BloomFilter
} from "bloomfilter"

// Hash list
let hashes = new BloomFilter(
    1592401693, // Number of bits to allocate
    33 // Number of hash functions
)

// If hashes have loaded
let hashesLoaded = false

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
        }).on("end", () => {
            resolve(lineCount)
        }).on("error", reject)
})

const loadHashes = () => {
    // Line by line reader
    import LineByLineReader from "line-by-line"

    countFileLines(path.join(storage, "hashlist.txt")).then((lines) => {
        $(".main--progress").get(0).MDCLinearProgress.determinate = true

        let done = 0

        // Line reader
        const hlr = new LineByLineReader(path.join(storage, "hashlist.txt"), {
            encoding: "utf8",
            skipEmptyLines: true
        })

        // Line reader error
        hlr.on("error", (err) => {
            if (err) snackBarMessage(`An error occurred: ${err}`)
        })

        // New line from line reader
        hlr.on("line", (line) => {
            done++
            $(".main--progress").get(0).MDCLinearProgress.progress = done / lines
            hashes.add(line)
        })

        // Line reader finished
        hlr.on("end", () => {
            $(".main--progress").get(0).MDCLinearProgress.close()
            $(".scan--loading").hide()
            $(".scan--start-container").show()
            hashesLoaded = true
        })
    })
}

// Request parameters
const requestParams = (url, json = false) => ({
    url,
    json,
    gzip: true,
    method: "GET",

    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0 WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3163.100 Safari/537.36"
    }
})

// When directory selected
$(".scan--directory-helper").change(() => {
    // The textfield value to path selected
    $(".scan--directory").get(0).MDCTextField.value = $(".scan--directory-helper").get(0).files[0].path
})

// When choose directory button clicked
$(".scan--directory-choose").click(() => {
    // Activate directory chooser
    $(".scan--directory-helper").click()
})

// Time parser
// import dayjs from "dayjs"

// MD5 from file
import MD5File from "md5-file"

const safe = (dir, hashes) => new Promise((resolve, reject) => {
    fs.lstat(path.resolve(dir), (err, stats) => {
        if (err) reject(err)
        // If path is a directory
        if (stats.isDirectory()) resolve(true)
        // Get the MD5 of a file
        MD5File(path.resolve(dir), (err, hash) => {
            if (err) reject(err)
            // If the hash is in the list
            resolve(!hashes.test(hash))
        })
    })
})

const scan = (dir, action) => new Promise((resolve, reject) => {
    safe(dir, hashes).then((isSafe) => {
        if (!isSafe) {
            if (action === "remove") {
                // Delete the file
                fs.unlink(file, (err) => {
                    if (err) reject(err)
                    snackBarMessage(`${file} was identified as a threat and was deleted.`, 0.1)
                })
            } else if (action === "quarantine") {
                fs.rename(file, path.resolve(path.join(args.data, "quarantine"), path.basename(file)), (err) => {
                    if (err) reject(err)
                    snackBarMessage(`${file} was identified as a threat and was quarantined.`, 0.1)
                    resolve()
                })
            } else {
                resolve()
            }
        }
    }, (err) => {
        reject(err)
    })
})

import {
    EventEmitter
} from 'events'

// External file requester
import request from "request"
import rprog from "request-progress"

class update extends EventEmitter {
    constructor(hashes, lastmodified) {

        super()

        const self = this

        // Download latest commit date of hash list
        request(requestParams("https://api.github.com/repos/Richienb/virusshare-hashes/commits/master", true), (err, _, {
            commit
        }) => {
            if (err) self.emit("error", err)

            // Write date to file
            fs.writeFile(lastmodified, commit.author.date, () => {})
        })

        // Download hashlist
        rprog(request(requestParams("https://media.githubusercontent.com/media/Richienb/virusshare-hashes/master/virushashes.txt")))
            .on("error", (err) => {
                self.emit("error", err)
            })
            .on("progress", ({
                size
            }) => {
                self.emit("progress", size.transferred, size.total)
            })
            .on("end", () => {
                self.emit("end", station)
            })
            .pipe(fs.createWriteStream(hashes))
    }
}

const checkupdate = lastmodified => new Promise((resolve, reject) => {
    // Request the GitHub API rate limit
    request(requestParams("https://api.github.com/rate_limit", true), (err, _, body) => {
        if (err) reject("error", err)

        // Check the quota limit
        if (body.resources.core.remaining === 0) {
            // If no API quota remaining
            resolve({
                quota: false,
                reset: body.resources.core.reset,
                outofdate: false
            })
        } else {
            // Check for the latest commit
            request(requestParams("https://api.github.com/repos/Richienb/virusshare-hashes/commits/master", true), (err, _, body) => {
                if (err) reject("error", err)

                // Get download date of hashlist
                const current = dayjs(lastmodified)

                // Get latest commit date of hashlist
                const now = dayjs(body.commit.author.date, "YYYY-MM-DDTHH:MM:SSZ")

                // Check if current is older than now
                resolve({
                    quota: true,
                    reset: body.resources.core.reset,
                    outofdate: current.isBefore(now)
                })
            })
        }
    })
})

checkupdate(path.join(storage, "scanning", "lastmodified.txt")).then((stats) => {
    if (stats.outofdate === false) {
        loadHashes()
    } else {
        update(path.join(storage, "scanning", "hashlist.txt"), path.join(storage, "scanning", "lastmodified.txt"))
    }
})

// Root directory
// const scanDir = path.parse(process.cwd()).root

// Home directory
const scanDir = require("os").homedir()

// Downloads directory
const watchDir = path.resolve(require('downloads-folder')())

$(".scan--directory").get(0).MDCTextField.value = scanDir

let total = 0
let done = 0

// If scan start triggered
$(".scan--start").click(() => {
    // Switch to scanning tab
    app.setActiveTab("scanning")

    db.getItem("recursive-scan").then((recursive) => {
        if (recursive) {
            db.getItem("regex-matching").then((regex) => {
                require("glob")(path.join($(".scan--directory").get(0).MDCTextField.value, regex ? regex : "/**/*"), (err, files) => {
                    if (err) snackBarMessage(`An error occurred: ${err}`)

                    // Make progress bar determinate
                    $(".scanning--progress").get(0).MDCLinearProgress.determinate = true

                    // Start progressbar
                    total = files.length

                    files.forEach((file) => {
                        // If the MD5 hash is in the list
                        scan(file, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {
                            done++
                            $(".scanning--progress").get(0).MDCLinearProgress.value = done / total
                        }, (err) => {
                            if (err) snackBarMessage(`A scanning error occurred: ${err}`)
                        })
                    })
                })
            })
        } else {
            fs.readdir(path.resolve($(".scan--directory").get(0).MDCTextField.value), (err, files) => {
                if (err) snackBarMessage(`An error occurred: ${err}`)

                $(".scanning--progress").get(0).MDCLinearProgress.determinate = true

                // Start progressbar
                total = files.length

                // For each file
                files.forEach((file) => {
                    // If the MD5 hash is in the list
                    scan(file, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {
                        done++
                        $(".scanning--progress").get(0).MDCLinearProgress.value = done / total
                    }, (err) => {
                        snackBarMessage(`A scanning error occurred: ${err}`)
                    })
                })
            })
        }
    })
})

// Settings manager
const manageSettings = (el, name) => {
    if (el.hasClass("mdc-select")) {
        const mdcSelect = el.get(0).MDCSelect
        db.getItem(name).then((val) => {
            if (typeof val !== 'undefined') mdcSelect.value = val
            mdcSelect.listen("MDCSelect:change", () => {
                db.setItem(name, mdcSelect.value)
            })
        })
    } else if (el.hasClass("mdc-text-field")) {
        const mdcTextField = el
        db.getItem(name).then((val) => {
            if (typeof val !== 'undefined') mdcTextField.get(0).MDCTextField.value = val
            mdcTextField.find("input").on("input", () => {
                db.setItem(name, mdcTextField.get(0).MDCTextField.value)
            })
        })
    } else if (el.hasClass("mdc-switch")) {
        const mdcSwitch = el
        db.getItem(name).then((val) => {
            if (typeof val !== 'undefined') mdcSwitch.get(0).MDCSwitch.checked = val
            mdcSwitch.find(".mdc-switch__native-control").on("change", () => {
                db.setItem(name, mdcSwitch.get(0).MDCSwitch.checked)
            })
        })
    } else {
        snackBarMessage(`Error syncronising ${name}.`)
    }
}

manageSettings($(".settings--update-behaviour"), "update-behaviour")
manageSettings($(".settings--regex-matching"), "regex-matching")
manageSettings($(".settings--rtp"), "rtp")
manageSettings($(".settings--recursive-scan"), "recursive-scan")
manageSettings($(".settings--threat-handling"), "threat-handling")

import chokidar from "chokidar"

let watcher

$(".settings--rtp").find(".mdc-switch__native-control").on("change", () => {
    if ($(".settings--rtp").get(0).MDCSwitch.checked) {

        watcher = chokidar.watch(watchDir, {
            persistent: true
        })

        watcher
            .on("add", dir => {
                scan(dir, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {}, (err) => {
                    if (err) snackBarMessage(`A scanning error occurred: ${err}`)
                })
            })
            .on("change", dir => {
                scan(dir, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {}, (err) => {
                    if (err) snackBarMessage(`A scanning error occurred: ${err}`)
                })
            })
            .on("error", err => {
                if (err.code = "EPERM") {
                    console.warn(`Not enough permissions provided to watch a directory. Please run ROS AV as an administrator (${err.message})`)
                } else {
                    snackBarMessage(`An real time protection error occurred: ${err}`)
                }
            })
    } else {
        if (watcher) watcher.close()
    }
})

$(".settings--rtp").find(".mdc-switch__native-control").trigger("change")

// Execute plugins
fs.readdir(path.join(storage, "plugins"), (err, items) => {
    if (err) snackBarMessage(`Failed to load plugins because ${err}`)

    items.forEach((dir) => {
        if (dir.endsWith(".js")) {
            fs.readFile(path.join(storage, "plugins", dir), "utf8", (err, contents) => {
                if (err) {
                    snackBarMessage(`Failed to load ${dir} because ${err}`)
                } else {
                    (() => {
                        try {
                            eval(contents)
                        } catch (err) {
                            snackBarMessage(`Failed to load ${dir} because ${err}`)
                        }
                    })()
                    snackBarMessage(`Successfully loaded ${dir}`)
                }
            })
        }
    })
})

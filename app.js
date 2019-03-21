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

const appIcon = process.platform === "darwin" ? path.join(__dirname, "build", "icons", "mac", "icon.icns") : path.join(__dirname, "build", "icons", "win", "icon.ico")

// Display snackbar message
const snackBarMessage = (message, volume = 0.0) => {
    snackbar.close()
    snackbar.labelText = message
    snackbar.open()
    notifier.notify({
        title: "ROS AV",
        message,
        icon: appIcon,
        sound: false
    })
    if (volume > 0.0) {
        $(".ping").get(0).volume = volume
        $(".ping").get(0).play()
    }
}

const populateDirectory = (dir) => {
    fs.access(dir, fs.constants.F_OK, (err) => {
        if (err) {
            fs.mkdir(dir, {
                recursive: true
            }, (err) => {
                if (err) snackBarMessage(`Unable to create application directories. (${err})`)
            })
        }
    })
}

// App data storage path
import electron from 'electron'

// Set storage location
const storage = path.join((electron.app || electron.remote.app).getPath("appData"), "rosav")

// Populate storage locations
populateDirectory(storage)
populateDirectory(path.join(storage, "scanning"))
populateDirectory(path.join(storage, "quarantine"))
populateDirectory(path.join(storage, "reports"))
populateDirectory(path.join(storage, "plugins"))

// Settings storage
import db from "node-persist"

// Initialise storage
db.init({
    dir: path.join(path.join(storage, "settings"))
})

mdc.autoInit()

import $ from "jquery"

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

// Line by line reader
import LineByLineReader from "line-by-line"

// Hashes loader
const loadHashes = () => {
    countFileLines(path.join(storage, "scanning", "hashlist.txt")).then((lines) => {
        $(".main--progress").get(0).MDCLinearProgress.determinate = true

        let done = 0

        // Line reader
        const hlr = new LineByLineReader(path.join(storage, "scanning", "hashlist.txt"), {
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
import dayjs from "dayjs"

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

const update = (hashes, lastmodified) => {
    const self = new EventEmitter()

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
            self.emit("end")
        })
        .pipe(fs.createWriteStream(hashes))

    return self
}

const checkupdate = (hashlist, lastmodified) => new Promise((resolve, reject) => {
    fs.access(hashlist, fs.constants.F_OK, (err) => {
        if (err) resolve({
            fileexists: false,
            outofdate: true
        })
        // Request the GitHub API rate limit
        request(requestParams("https://api.github.com/rate_limit", true), (err, _, {
            resources
        }) => {
            if (err) reject("error", err)

            // Check the quota limit
            if (resources.core.remaining === 0) {
                // If no API quota remaining
                resolve({
                    quota: false,
                    fileexists: true,
                    reset: resources.core.reset,
                    outofdate: false
                })
            } else {
                // Check for the latest commit
                request(requestParams("https://api.github.com/repos/Richienb/virusshare-hashes/commits/master", true), (err, _, {
                    commit
                }) => {
                    if (err) reject("error", err)

                    // Get download date of hashlist
                    const current = dayjs(lastmodified)

                    // Get latest commit date of hashlist
                    const now = dayjs(commit.author.date, "YYYY-MM-DDTHH:MM:SSZ")

                    // Check if current is older than now
                    resolve({
                        quota: true,
                        fileexists: true,
                        reset: resources.core.reset,
                        outofdate: current.isBefore(now)
                    })
                })
            }
        })
    })
})

checkupdate(path.join(storage, "scanning", "hashlist.txt"), path.join(storage, "scanning", "lastmodified.txt")).then(({
    outofdate
}) => {
    if (outofdate === false) {
        loadHashes()
    } else {
        update(path.join(storage, "scanning", "hashlist.txt"), path.join(storage, "scanning", "lastmodified.txt")).on("progress", (done, total) => {
            // Make progress bar determinate
            $(".scanning--progress").get(0).MDCLinearProgress.determinate = true

            // Make progress bar determinate
            $(".scanning--progress").get(0).MDCLinearProgress.value = done / total
        }).on("end", () => {
            loadHashes()
        })
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
    if (!hashesLoaded) {
        snackBarMessage("Hashes not fully loaded.")
        return
    }

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
                        if (hashesLoaded) scan(file, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {
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
                    if (hashesLoaded) scan(file, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {
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
                if (hashesLoaded) scan(dir, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {}, (err) => {
                    if (err) snackBarMessage(`A scanning error occurred: ${err}`)
                })
            })
            .on("change", dir => {
                if (hashesLoaded) scan(dir, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {}, (err) => {
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
    } else if (watcher.close) watcher.close()
})

$(".settings--rtp").find(".mdc-switch__native-control").trigger("change")

// Execute plugins
fs.readdir(path.join(storage, "plugins"), (err, items) => {
    if (err) snackBarMessage(`Failed to load plugins because ${err}`)

    // If no plugins installed
    if (!items) return

    items.forEach((dir) => {
        if (dir.endsWith(".js")) {
            fs.readFile(path.join(storage, "plugins", dir), "utf8", (err, contents) => {
                if (err) {
                    snackBarMessage(`Failed to load ${dir} because ${err}`)
                } else {
                    try {
                        (() => {
                            eval(contents)
                        })()
                    } catch (err) {
                        snackBarMessage(`Failed to load ${dir} because ${err}`)
                    }
                    snackBarMessage(`Successfully loaded ${dir}`)
                }
            })
        }
    })
})

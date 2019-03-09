import $ from "jquery"

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

// Path functions
import path from "path"

// Provide improved filesystem functions
import _realFs from "fs"
import _gracefulFs from "graceful-fs"
_gracefulFs.gracefulify(_realFs)
import fs from "graceful-fs"

const populateDirectory = (dir) => {
    fs.access(dir, (err) => {
        if (err) {
            fs.mkdir(dir, {
                recursive: true
            }, (err) => {
                if (err) throw err
            })
        }
    })
}

// Define storage path
const storage = path.join(require("temp-dir"), "rosav")

populateDirectory(storage)
populateDirectory(path.join(storage, "quarantine"))
populateDirectory(path.join(storage, "reports"))
populateDirectory(path.join(storage, "plugins"))
populateDirectory(path.join(storage, "hashlist"))

// Settings storage
import db from 'node-persist'

// Initialise storage
db.init({
    dir: path.join(storage, "db")
})

// Intialise MDC list
const list = mdc.list.MDCList.attachTo($('.main--drawer-content').get(0))

// Fix focusing
list.wrapFocus = true

// Automatically initialise ripples
mdc.autoInit()

// For each icon button with ripples
$.each($(".mdc-icon-button[data-mdc-auto-init='MDCRipple']"), (_, {
    MDCRipple
}) => {
    // Fix ripples
    MDCRipple.unbounded = true
})

// Attach snackbar
const snackbar = new mdc.snackbar.MDCSnackbar($('.main--snackbar').get(0))

// Display snackbar message
const snackBarMessage = (message) => {
    snackbar.close()
    snackbar.labelText = message
    snackbar.open()
}

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

const countFileLines = (filePath) => {
    return new Promise((resolve, reject) => {
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
}

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
        handleError(err)
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

// Request parameters
const requestParams = (url, json = false) => ({
    url,
    json,
    gzip: true,
    method: "GET",

    headers: {
        "User-Agent": "rosav (nodejs)"
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

// External file requester
import request from "request"
import rprog from "request-progress"

// Time parser
import dayjs from "dayjs"

// If scan start triggered
$(".scan--start").click(() => {
    // Switch to scanning tab
    app.setActiveTab('scanning')
})

// Settings manager
const manageSettings = (el, name) => {
    if (el.hasClass("mdc-select")) {
        const mdcSelect = el.get(0).MDCSelect
        db.getItem(name).then((content) => {
            if (content) mdcSelect.value = content
        })
        mdcSelect.listen('MDCSelect:change', () => {
            db.setItem(name, mdcSelect.value)
        })
    } else if (el.hasClass("mdc-text-field")) {
        const mdcTextField = el
        db.getItem(name).then((content) => {
            if (content) mdcTextField.get(0).MDCTextField.value = content
        })
        mdcTextField.find("input").on("input", () => {
            db.setItem(name, mdcTextField.get(0).MDCTextField.value)
        })
    } else if (el.hasClass("mdc-switch")) {
        const mdcSwitch = el
        db.getItem(name).then((content) => {
            if (content) mdcSwitch.get(0).MDCSwitch.checked = content
        })
        mdcSwitch.find(".mdc-switch__native-control").on('change', () => {
            db.setItem(name, mdcSwitch.get(0).MDCSwitch.checked)
        })
    } else {
        snackBarMessage(`Error syncronising ${name}.`)
    }
}

manageSettings($(".settings--update-behaviour"), "update-behaviour")
manageSettings($(".settings--regex-matching"), "regex-matching")
manageSettings($(".settings--rtp"), "rtp")
manageSettings($(".settings--recursive-scan"), "recursive-scan")

// MD5 from file
import MD5File from "md5-file"

const safe = (dir) => {
    fs.lstat(dir, (err, stats) => {
        if (err) {
            handleError(err)
        }
        // If path is not a directory
        if (!stats.isDirectory()) {
            // Get the MD5 of a file
            MD5File(dir, (err, hash) => {
                if (err) {
                    handleError(err)
                }
                // If the hash is in the list
                if (hashes.test(hash)) {
                    console.log(c.red(`${dir} is dangerous!`))

                    if (args.action === "remove") {
                        // Delete the file
                        fs.unlink(dir, (err) => {
                            if (err) {
                                handleError(err)
                            }
                            if (args.verbose) {
                                // If verbose is enabled
                                console.log(c.green(`${dir} successfully deleted.`))
                            }
                        })
                    } else if (args.action === "quarantine") {
                        fs.rename(dir, path.resolve(path.join(args.data, "quarantine"), path.basename(dir)), (err) => {
                            if (err) {
                                handleError(err)
                            }
                            if (args.verbose) {
                                // If verbose is enabled
                                console.log(c.green(`${dir} successfully quarantined.`))
                            }
                        })
                    }
                    updateCLIProgress()
                } else {
                    if (args.verbose) {
                        // Otherwise, if verbose is enabled
                        console.log(c.green(`${path} is safe.`))
                    }
                    updateCLIProgress()
                }
            })
        } else {
            updateCLIProgress()
        }

    })
}

// Root directory
// const watchDir = path.parse(process.cwd()).root

// Home directory
const watchDir = require('os').homedir()

import chokidar from 'chokidar'

// const watcher = chokidar.watch(watchDir, {
//     persistent: true
// })
//
// watcher
//     .on('add', dir => {
//         console.log('File', dir, 'has been added')
//     })
//     .on('change', dir => {
//         console.log('File', dir, 'has been changed')
//     })
//     .on('unlink', dir => {
//         console.log('File', dir, 'has been removed')
//     })
//     .on('error', err => {
//         if (err.code = "EPERM") {
//             console.warn(`Not enough perms not provided to watch a directory. Please run ROS AV as administrator (${err.message})`)
//         } else {
//             snackBarMessage(`An real time protection error occurred: ${err}`)
//         }
//     })

// Execute plugins
fs.readdir(path.join(storage, "plugins"), (err, items) => {
    if (err) {
        snackBarMessage(`Failed to load plugins because ${err}`)
    }
    items.forEach((dir) => {
        (() => {
            if (dir.endsWith(".js")) {
                fs.readFile(path.join(storage, "plugins", dir), 'utf8', (err, contents) => {
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
        })()
    })
})

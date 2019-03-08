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

// Line by line reader
import LineByLineReader from "line-by-line"

// Request parameters
const requestParams = (url, json = false) => {
    return {
        url: url,
        json: json,
        gzip: true,
        method: "GET",
        headers: {
            "User-Agent": "rosav (nodejs)"
        }
    }
}

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
    hashes.add(line)
})

// Line reader finished
hlr.on("end", () => {
    $(".main--progress").get(0).MDCLinearProgress.close()
    $(".scan--loading").hide()
    $(".scan--start-container").show()
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

// MD5 from file
import MD5File from "md5-file"

// If scan start triggered
$(".scan--start").click(() => {
    // Switch to scanning tab
    app.setActiveTab('scanning')
})

const manageSettings = (el, name) => {
    if (el.hasClass("mdc-select")) {
        const select = el.get(0).MDCSelect
        if (db.getItem(name)) select.value = db.getItem(name)
        select.listen('MDCSelect:change', () => {
            db.setItem(name, select.value)
        })
    } else if (el.hasClass("mdc-text-field")) {
        const textField = el
        if (db.getItem(name)) textField.get(0).MDCTextField.value = db.getItem(name)
        textField.find("input").on("input", () => {
            db.setItem(name, textField.get(0).MDCTextField.value)
        })
    }
}

manageSettings($(".settings--update-behaviour"), "update-behaviour")
manageSettings($(".settings--regex-matching"), "regex-matching")

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

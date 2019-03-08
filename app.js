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
                if (err) throw err;
            });
        }
    });
}

// Define storage path
const storage = path.join(require("temp-dir"), "rosav")

populateDirectory(storage)

// Settings storage
import db from 'node-persist'

// Initialise storage
db.init({
    dir: path.join(storage, "db")
})

// Intialise MDC list
const list = mdc.list.MDCList.attachTo(document.querySelector('.mdc-list'))

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

$(".scan--start").click(() => {
    app.setActiveTab('scanning')
})

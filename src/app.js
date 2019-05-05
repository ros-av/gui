// setImmediate Polyfill
const _setImmediate = setImmediate
process.once("loaded", () => global.setImmediate = _setImmediate)

// Electron
const electron = require("electron")

require("electron-compile/lib/initialize-renderer").initializeRendererProcess(electron.remote.getGlobal("globalCompilerHost").readOnlyMode)

const mainWindow = electron.remote.getCurrentWindow()

// Bloom filter
import {
    BloomFilter
} from "bloomfilter"

import lib from "./lib"

import * as lzjs from "lzjs"

import Vue from "vue/dist/vue.min.js"

import path from "path"

import dayjs from "dayjs"

import * as chokidar from "chokidar"

// Provide improved filesystem functions
const fs = require("graceful-fs").gracefulify(require("fs"))

const rprog = require("request-progress")

import {
    Promise
} from "bluebird"

const countFileLines = Promise.promisify(require("count-lines-in-file"))

import LineByLineReader from "line-by-line"

import {
    EventEmitter,
} from "events"

import Store from "electron-store"
const db = new Store({
    cwd: "settings",
})

import * as mdc from "material-components-web"

const dirs = {
    rootdir: path.parse(process.cwd()).root, // Root directory
    tempdir: path.join(require("temp-dir"), "rosav"), // Temporary directory
    homedir: require("os").homedir(), // Home directory
    downdir: path.resolve(require("downloads-folder")()), // Downloads directory
    storedir: path.join((electron.app || electron.remote.app).getPath("appData"), "rosav"), // Storage directory
}

const files = {
    hashlist: path.join(dirs.storedir, "scanning", "hashlist.lzstring.json"), // Hashlist file
    lastmodified: path.join(dirs.storedir, "scanning", "lastmodified.txt"), // Last modified file
    hashesparams: path.join(dirs.storedir, "scanning", "hashesparams.txt"), // Hashlist parameters file
    hashtxt: path.join(dirs.tempdir, "hashlist.txt"), // Temporary hashlist file
}

// Populate storage locations
lib.populateDirectory(dirs.storedir)
lib.populateDirectory(path.join(dirs.storedir, "scanning"))
lib.populateDirectory(path.join(dirs.storedir, "quarantine"))
lib.populateDirectory(path.join(dirs.storedir, "reports"))
lib.populateDirectory(path.join(dirs.storedir, "plugins"))
lib.populateDirectory(dirs.tempdir)

// Settings manager
const manageSettings = async (el, name) => {
    if (el.hasClass("mdc-select")) {
        const mdcSelect = el.get(0).MDCSelect
        const val = db.get(name)
        if (typeof val !== "undefined") mdcSelect.value = val
        mdcSelect.listen("MDCSelect:change", () => {
            db.set(name, mdcSelect.value)
        })
    } else if (el.hasClass("mdc-text-field")) {
        const mdcTextField = el
        const val = db.get(name)
        if (typeof val !== "undefined") mdcTextField.get(0).MDCTextField.value = val
        mdcTextField.find("input").on("input", () => {
            db.set(name, mdcTextField.get(0).MDCTextField.value)
        })
    } else if (el.hasClass("mdc-switch")) {
        const mdcSwitch = el
        const val = db.get(name)
        if (typeof val !== "undefined") mdcSwitch.get(0).MDCSwitch.checked = val
        mdcSwitch.find(".mdc-switch__native-control").on("change", () =>
            db.set(name, mdcSwitch.get(0).MDCSwitch.checked)
        )
    } else {
        snackBarMessage(`Error syncronising ${name}.`)
    }
}

const isJSON = (str) => {
    try {
        JSON.parse(str)
    } catch (e) {
        return false
    }
    return true
}

const runFile = (dir) => new Promise((resolve, reject) => {
    // Read the file contents
    fs.readFile(dir, (err, contents) => {
        if (err) reject(err)
        else {
            try {
                // Self containing function
                (() => {
                    // Evaluate contents
                    eval(contents)
                })()
            } catch (err) {
                reject(err)
            }
            resolve()
        }
    })
})

const runPlugin = (dir) => new Promise((resolve, reject) => {
    // Get path stats
    fs.stat(dir, (err, stats) => {
        if (err) reject(err)

        // Get path extension
        const ext = dir.split(".")[0]

        // If path is directory run index.js file inside of the directory
        if (stats.isDirectory()) runFile(path.join(dir, "index.js")).then(resolve).catch(reject)

        // If extension is JS run it
        else if (ext === "js") runFile(dir).then(resolve).catch(reject)

        // If extension is CSS run it
        else if (ext === "css") {
            $("head").append(`<link rel="stylesheet" href="${dir}">`)
            resolve()
        }

        // If unknown reject
        else reject(new TypeError("Only JS files, directories with JS files and CSS file allowed!"))
    })
})

const update = (hashlist, hashesparams, lastmodified, temphashes) => {
    const self = new EventEmitter()

    // Download latest commit date of hash list
    lib.githubapi("https://api.github.com/repos/Richienb/virusshare-hashes/commits/master", (err, _, {
        commit,
    }) => {
        if (err) self.emit("error", err)

        // Write date to file
        if (isJSON(commit)) fs.writeFile(lastmodified, commit.author.date, () => {})
    })

    // Download hashlist
    rprog(lib.request("https://media.githubusercontent.com/media/Richienb/virusshare-hashes/master/virushashes.txt"))
        .on("error", (err) => self.emit("error", err))
        .on("progress", ({
            size,
        }) => self.emit("progress", {
            done: size.transferred / size.total / 2,
            total: 1.0,
        }))
        .on("end", () => countFileLines(temphashes).then(lines => {
            const bestFilter = lib.bestForBloom(
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
            hlr.on("error", err => self.emit("error", err))

            // New line from line reader
            hlr.on("line", line => {
                hashes.add(line)
                done++
                self.emit("progress", done / lines + 0.5, 1.0)
            })

            // Line reader finished
            hlr.on("end", () => {
                fs.writeFile(hashlist, lzjs.compress(JSON.stringify([].slice.call(hashes.buckets))), err => {
                    if (err) reject(err)
                    fs.writeFile(hashesparams, bestFilter[1].toString(), () => self.emit("end"))
                })
            })
        }).catch(err => self.emit("progress", err)))
        .pipe(fs.createWriteStream(temphashes))
    return self
}

const checkupdate = (hashlist, lastmodified) => new Promise((resolve, reject) => {
    fs.access(hashlist, fs.constants.F_OK, (err) => {
        if (err) resolve({
            fileexists: false,
            outofdate: true,
        })
        lib.githubapi("https://api.github.com/rate_limit", (err, _, {
            resources,
        }) => {
            if (err) reject(err)

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
                lib.githubapi("https://api.github.com/repos/Richienb/virusshare-hashes/commits/master", (err, _, {
                    commit,
                }) => {
                    if (err) reject(err)

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
            }
        })
    })
})

window.onload = () => {
    window.$ = require("jquery")
    // When a directory is selected set the textfield value to the selected path
    $(".scan--directory-helper").change(() =>
        $(".scan--directory").get(0).MDCTextField.value = $(".scan--directory-helper").get(0).files[0].path
    )

    // When document finished loading
    $(document).ready(() => {
        // When the choose directory button is clicked activate directory chooser
        $(".scan--directory-choose").click(() => $(".scan--directory-helper").click())

        $(".scan--directory").get(0).MDCTextField.value = dirs.homedir
    })

    // Define Vue app
    const app = new Vue({
        el: ".app",
        data: {
            activeTab: "dashboard",
        },
        methods: {
            isActiveTab(tabId) {
                return this.activeTab === tabId
            },
            setActiveTab(tabId) {
                this.activeTab = tabId
            },
        },
    })

    // Auto init MDC elements
    mdc.autoInit()

    // Fix the ripples of each icon button
    $(".mdc-icon-button[data-mdc-auto-init=\"MDCRipple\"]").each((_, {
        MDCRipple,
    }) => MDCRipple.unbounded = true)

    // Setup window actions
    $(".bar__close").click(() => mainWindow.hide())
    $(".bar__max").click(() => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize()
            $(".bar__max svg").html(`<path d="M4,4H20V20H4V4M6,8V18H18V8H6Z" />`)
        } else {
            mainWindow.maximize()
            $(".bar__max svg").html(`<path d="M4,8H8V4H20V16H16V20H4V8M16,8V14H18V6H10V8H16M6,12V18H14V12H6Z" />`)
        }
    })
    $(".bar__min").click(() => mainWindow.minimize())

    // If scan start triggered
    $(".scan--start").click(() => {
        if (!hashesLoaded) {
            snackBarMessage("Hashes not fully loaded.")
            return
        }

        // Switch to scanning tab
        app.setActiveTab("scanning")

        db.get("recursive-scan").then((recursive) => {
            if (recursive) {
                db.get("regex-matching").then((regex) => {
                    fg(path.join($(".scan--directory").MDCTextField.value, regex || "/**/*").get(0), {
                        onlyFiles: true,
                    }).then((files) => {
                        // Make progress bar determinate
                        $(".app--progress").get(0).MDCLinearProgress.determinate = true

                        // Start progressbar
                        total = files.length

                        files.forEach((file) => {
                            // If the MD5 hash is in the list
                            if (hashesLoaded) {
                                scan(file, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {
                                    done++
                                    $(".app--progress").get(0).MDCLinearProgress.progress = done / total
                                }, (err) => {
                                    if (err) snackBarMessage(`A scanning error occurred: ${err}`)
                                })
                            }
                        })
                    })
                })
            } else {
                fs.readdir(path.resolve($(".scan--directory").get(0).MDCTextField.value), (err, files) => {
                    if (err) snackBarMessage(`An error occurred: ${err}`)

                    $(".app--progress").get(0).MDCLinearProgress.determinate = true

                    // Start progressbar
                    total = files.length

                    // For each file
                    files.forEach((file) => {
                        // If the MD5 hash is in the list
                        if (hashesLoaded) {
                            scan(file, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {
                                done++
                                $(".app--progress").get(0).MDCLinearProgress.progress = done / total
                            }, (err) => {
                                snackBarMessage(`A scanning error occurred: ${err}`)
                            })
                        }
                    })
                })
            }
        })
    })

    manageSettings($(".settings--update-behaviour"), "update-behaviour")
    manageSettings($(".settings--regex-matching"), "regex-matching")
    manageSettings($(".settings--rtp"), "rtp")
    manageSettings($(".settings--recursive-scan"), "recursive-scan")
    manageSettings($(".settings--threat-handling"), "threat-handling")

    let watcher

    $(".settings--rtp").find(".mdc-switch__native-control").on("change", () => {
        if ($(".settings--rtp").get(0).MDCSwitch.checked) {
            watcher = chokidar.watch(dirs.watchdir, {
                persistent: true,
            })

            watcher
                .on("add", (dir) => {
                    if (hashesLoaded) {
                        scan(dir, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {}, (err) => {
                            if (err) snackBarMessage(`A scanning error occurred: ${err}`)
                        })
                    }
                })
                .on("change", (dir) => {
                    if (hashesLoaded) {
                        scan(dir, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {}, (err) => {
                            if (err) snackBarMessage(`A scanning error occurred: ${err}`)
                        })
                    }
                })
                .on("error", (err) => {
                    console.warn(`Not enough permissions provided to watch a directory. Please run ROS AV as an administrator (${err.message})`)
                })
        } else if (watcher) watcher.close()
    })

    $(".settings--rtp").find(".mdc-switch__native-control").trigger("change")

    const appIcon = process.platform === "darwin" ? path.join(__dirname, "build", "icons", "mac", "icon.icns") : path.join(__dirname, "build", "icons", "win", "icon.ico")

    // Display snackbar message
    const snackBarMessage = (message, volume = 0.0) => {
        const snackbar = $(".main--snackbar").get(0).MDCSnackbar
        snackbar.close()
        snackbar.labelText = message
        snackbar.open()
        notifier.notify({
            title: "ROS AV",
            message,
            icon: appIcon,
            sound: false,
        })
        if (volume > 0.0) {
            $(".ping").get(0).volume = volume
            $(".ping").get(0).play()
        }
    }

    // If hashes have loaded
    let hashesLoaded = false

    let hashes

    const scan = (dir, action) => new Promise((resolve, reject) => {
        // Check if file is safe
        lib.safe(dir, hashes).then(({
            safe,
        }) => {
            if (!safe) {
                if (action === "remove") {
                    // Delete the file
                    fs.unlink(file, (err) => {
                        if (err) reject(err)
                        snackBarMessage(`${file} was identified as a threat and was deleted.`, 0.1)
                        resolve({
                            safe: false,
                        })
                    })
                } else if (action === "quarantine") {
                    fs.rename(file, path.resolve(args.data, "quarantine", path.basename(file)), (err) => {
                        if (err) reject(err)
                        snackBarMessage(`${file} was identified as a threat and was quarantined.`, 0.1)
                        resolve({
                            safe: false,
                        })
                    })
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
        }).catch(e => reject(e))
    })

    // Check for updates
    checkupdate(files.hashlist, files.lastmodified).then(({
        outofdate,
    }) => {
        // If not out of date load hashes
        if (!outofdate) {
            lib.loadHashes(files.hashlist, files.hashesparams).then((o) => {
                hashes = o
                hashesLoaded = true
                $(".app--progress").get(0).MDCLinearProgress.close()
            })
        }

        // If out of date update hashes
        else {
            const u = update(files.hashlist, files.hashesparams, files.lastmodified, files.hashtxt)
            // When progress occurred
            u.on("progress", ({
                done,
                total,
            }) => {
                // Make progress bar determinate
                $(".app--progress").get(0).MDCLinearProgress.determinate = true

                // Make progress bar determinate
                $(".app--progress").get(0).MDCLinearProgress.progress = done / total
            })
            // When complete
            u.on("end", () => {
                // Load hashes
                lib.loadHashes(files.hashlist, files.hashesparams).then((o) => {
                    hashes = o
                    hashesLoaded = true
                    $(".app--progress").get(0).MDCLinearProgress.close()
                })
            })
        }
    })

    // Execute plugins
    fs.readdir(path.join(dirs.storedir, "plugins"), (err, items) => {
        if (err) snackBarMessage(`Failed to load plugins because ${err}`)

        // If no plugins installed
        if (!items) return

        // For each item in directory
        items.forEach((dir) =>
            runPlugin(path.join(dirs.storedir, "plugins", dir))
            .then(() => snackBarMessage(`Successfully loaded ${dir}`))
            .catch((err) => snackBarMessage(`Failed to load ${dir} because ${err}`)))
    })
}

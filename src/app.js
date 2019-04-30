// Electron
const electron = require("electron")

require("electron-compile/lib/initialize-renderer").initializeRendererProcess(electron.remote.getGlobal("globalCompilerHost").readOnlyMode)

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
    EventEmitter
} from 'events';

const Store = require("electron-store")
const db = new Store({
    cwd: "settings",
})

import * as mdc from "material-components-web"

// Root directory
// const scanDir = path.parse(process.cwd()).root

// Temporary directory
const tempdir = path.join(require("temp-dir"), "rosav")

// Home directory
const scanDir = require("os").homedir()

// Downloads directory
const watchDir = path.resolve(require("downloads-folder")())

// Settings manager
const manageSettings = (el, name) => {
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

const isJSON = str => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

const update = (hashes, hashesparams, lastmodified, temphashes) => {
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
        .on("error", err => self.emit("error", err))
        .on("progress", ({
            size,
        }) => self.emit("progress", size.transferred / size.total / 2, 1.0))
        .on("end", () => {
            lib.countFileLines(temphashes).then((fileLines) => {
                    const bestFilter = lib.bestForBloom(
                        fileLines, // Number of bits to allocate
                        1e-10, // Number of hash functions (currently set at 1/1 billion)
                    )

                    const hashes = new BloomFilter(
                        bestFilter[0],
                        bestFilter[1],
                    )

                    let done = 0

                    // Line reader
                    const hlr = new LineByLineReader(hashlist, {
                        encoding: "utf8",
                        skipEmptyLines: true,
                    })

                    // Line reader error
                    hlr.on("error", err => self.emit("error", err))

                    // New line from line reader
                    hlr.on("line", line => {
                        hashes.add(line)
                        done++
                        self.emit("progress", done / fileLines + 0.5, 1.0)
                    })

                    // Line reader finished
                    hlr.on("end", () => {
                        fs.writeFile(hashes, lzjs.compress(JSON.stringify([].slice.call(hashes.buckets))), (err) => {
                            if (err) reject(err)
                            fs.writeFile(hashesparams, bestFilter[1].toString(), () => self.emit("end"))
                        })
                    })
                })
                .pipe(fs.createWriteStream(temphashes))
        })
    return self
}

const checkupdate = (hashlist, lastmodified) => new Promise((resolve, reject) => {
    fs.access(hashlist, fs.constants.F_OK, err => {
        if (err) {
            resolve({
                fileexists: false,
                outofdate: true,
            })
        }
        lib.githubapi("https://api.github.com/rate_limit", (err, _, {
            resources,
        }) => {
            if (err) reject(new Error(err))

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
                    if (err) reject(new Error(err))

                    // Get download date of hashlist
                    const current = dayjs(lastmodified)

                    // Get latest commit date of hashlist
                    const now = dayjs(commit.author.date, "YYYY-MM-DDTHH:MM:SSZ")

                    // Check if current is older than now
                    resolve({
                        quota: true,
                        fileexists: true,
                        reset: resources.core.reset,
                        outofdate: current.isBefore(now),
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

    // When the choose directory button is clicked activate directory chooser
    $(".scan--directory-choose").click(() =>
        $(".scan--directory-helper").click()
    )

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
    $(`.mdc-icon-button[data-mdc-auto-init="MDCRipple"]`).each((_, {
        MDCRipple,
    }) => MDCRipple.unbounded = true)

    $(".scan--directory").get(0).MDCTextField.value = scanDir

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
                        $(".app-progress").get(0).MDCLinearProgress.determinate = true

                        // Start progressbar
                        total = files.length

                        files.forEach((file) => {
                            // If the MD5 hash is in the list
                            if (hashesLoaded) {
                                scan(file, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {
                                    done++
                                    $(".app-progress").get(0).MDCLinearProgress.value = done / total
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

                    $(".app-progress").get(0).MDCLinearProgress.determinate = true

                    // Start progressbar
                    total = files.length

                    // For each file
                    files.forEach((file) => {
                        // If the MD5 hash is in the list
                        if (hashesLoaded) {
                            scan(file, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => {
                                done++
                                $(".app-progress").get(0).MDCLinearProgress.value = done / total
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
            watcher = chokidar.watch(watchDir, {
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
        } else if (watcher.close) watcher.close()
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

    // Set storage location
    const storage = path.join((electron.app || electron.remote.app).getPath("appData"), "rosav")

    // Populate storage locations
    lib.populateDirectory(storage)
    lib.populateDirectory(path.join(storage, "scanning"))
    lib.populateDirectory(path.join(storage, "quarantine"))
    lib.populateDirectory(path.join(storage, "reports"))
    lib.populateDirectory(path.join(storage, "plugins"))

    // Hash list
    // let hashes = new BloomFilter(
    //     1592401693, // Number of bits to allocate
    //     33 // Number of hash functions
    // )

    // If hashes have loaded
    let hashesLoaded = false

    let hashes

    const scan = (dir, action) => new Promise((resolve, reject) => {
        lib.safe(dir, hashes).then((isSafe) => {
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

    checkupdate(path.join(storage, "scanning", "hashlist.lzstring.json"), path.join(storage, "scanning", "lastmodified.txt")).then(({
        outofdate
    }) => {
        if (outofdate === false) {
            lib.loadHashes(path.join(storage, "scanning", "hashlist.lzstring.json"), path.join(storage, "scanning", "hashesparams.txt")).then((out) => {
                hashes = out
            })
        } else {
            update(path.join(storage, "scanning", "hashlist.lzstring.json"), path.join(storage, "scanning", "hashesparams.txt"), path.join(storage, "scanning", "lastmodified.txt"), path.join(path.join(tempdir, "hashlist.txt")))
                .on("progress", (done, total) => {
                    // Make progress bar determinate
                    $(".app-progress").get(0).MDCLinearProgress.determinate = true

                    // Make progress bar determinate
                    $(".app-progress").get(0).MDCLinearProgress.value = done / total
                })
                .on("end", () => {
                    lib.loadHashes().then((out) => {
                        hashes = out
                        hashesLoaded = true
                    })
                })
        }
    })

    let total = 0
    let done = 0

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
}

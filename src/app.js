// Sentry error reporting
import * as Sentry from "@sentry/electron"
Sentry.init({dsn: "https://06cb13f75c06473896ff934eed943998@sentry.io/1493471"})

// ES6 support
require = require("esm")(module)

// Electron
import electron from "electron"

const mainWindow = electron.remote.getCurrentWindow()

import Vue from "vue/dist/vue.min.js"

import path from "path"

import chokidar from "chokidar"

import fs from "./utils/fs"

import snackBarMessage from "./app/snackBarMessage"

import Store from "electron-store"
const db = new Store({
    cwd: "settings",
    encryptionKey: "hCjBXNalGSdrRNftsbvQnXzJhToSKVNp",
})

import * as mdc from "material-components-web"

import dirs from "./utils/data/dirs"

// Populate storage locations
fs.ensureDir(dirs.storedir)
fs.ensureDir(path.join(dirs.storedir, "scanning"))
fs.ensureDir(path.join(dirs.storedir, "quarantine"))
fs.ensureDir(path.join(dirs.storedir, "reports"))
fs.ensureDir(path.join(dirs.storedir, "plugins"))
fs.ensureDir(dirs.tempdir)

// Settings manager
import manageSettings from "./app/manageSettings"

import openExplorer from "open-file-explorer"

window.onload = async () => {
    window.$ = require("jquery")
    // When a directory is selected set the textfield value to the selected path
    $(".scan--directory-helper").change(() =>
        $(".scan--directory").get(0).MDCTextField.value = $(".scan--directory-helper").get(0).files[0].path
    )

    // When document finished loading
    $(document).ready(() => {
        // When the choose directory button is clicked activate directory chooser
        $(".scan--directory-choose").click(() => $(".scan--directory-helper").click())

        $(".plugin__folder").click(() => openExplorer(path.join(dirs.storedir, "plugins")))

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
            $(".bar__max svg").html("<path d=\"M4,4H20V20H4V4M6,8V18H18V8H6Z\" />")
        } else {
            mainWindow.maximize()
            $(".bar__max svg").html("<path d=\"M4,8H8V4H20V16H16V20H4V8M16,8V14H18V6H10V8H16M6,12V18H14V12H6Z\" />")
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
                fs.readdir(path.resolve($(".scan--directory").get(0).MDCTextField.value))
                    .then((files) => {
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
                    .catch(({message}) => snackBarMessage(`An error occurred: ${message}`))
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
                        scan(dir, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => { }, (err) => {
                            if (err) snackBarMessage(`A scanning error occurred: ${err}`)
                        })
                    }
                })
                .on("change", (dir) => {
                    if (hashesLoaded) {
                        scan(dir, $(".settings--threat-handling").get(0).MDCSelect.value).then(() => { }, (err) => {
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


    // If hashes have loaded
    const hashesLoaded = false

    // Execute plugins
    fs.readdir(path.join(dirs.storedir, "plugins"))
        .then((items) => {
            // If no plugins installed
            if (!items) {
                $(".app--progress").get(0).MDCLinearProgress.close()
                return
            }

            const total = items.length
            let loaded = 0

            // For each item in directory
            items.forEach((dir) => {
                const p = require(path.join(dirs.storedir, "plugins", dir))
                p.onLoad()
                    .then(() => {
                        loaded++
                        $(".app--progress").get(0).MDCLinearProgress.progress = loaded / total
                        $(".app--progress").get(0).MDCLinearProgress.determinate = true
                        if (loaded === total) $(".app--progress").get(0).MDCLinearProgress.close()

                        const el = $(".plugin__list").append(`
                <div class="mdc-layout-grid__cell">
                            <div class="mdc-card mdc-card--outlined">
                                <div class="mdc-card__primary">
                                    <h2 class="mdc-card__title mdc-typography mdc-typography--headline6">${p.info.name}</h2>
                                    <h3 class="mdc-card__subtitle mdc-typography mdc-typography--subtitle2">by ${p.info.author}</h3>
                                </div>
                                <div class="mdc-card__secondary mdc-typography mdc-typography--body2">${p.info.description}</div>
                                <div class="mdc-card__actions">
                                    <div class="mdc-card__action-buttons">
                                        <button class="mdc-button mdc-card__action mdc-card__action--button" data-mdc-auto-init="MDCRipple">Details</button>
                                        <button class="mdc-button mdc-card__action mdc-card__action--button" data-mdc-auto-init="MDCRipple">Remove</button>
                                    </div>
                                    <div class="mdc-card__action-icons">
                                        <div class="plugin__switch mdc-switch" data-mdc-auto-init="MDCSwitch">
                                            <div class="mdc-switch__track"></div>
                                            <div class="mdc-switch__thumb-underlay">
                                                <div class="mdc-switch__thumb">
                                                    <input type="checkbox" class="mdc-switch__native-control" role="switch">
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
            `)
                        mdc.autoInit(el.get(0))
                    })
                    .catch(({message}) => snackBarMessage(`Failed to load ${dir} because ${message}`))
            }
            )
        })
}

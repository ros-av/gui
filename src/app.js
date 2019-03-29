console.count()

// App data storage path
import electron from "electron"
console.count()
import {
    Vue
} from "vue/dist/vue.esm.js"

console.count()
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
console.count()
// Jquery
const $ = require('jquery')
console.count()
// When directory selected
$(".scan--directory-helper").change(() => {
    // The textfield value to path selected
    document.querySelector(".scan--directory").get(0).MDCTextField.value = $(".scan--directory-helper").files[0].path
})

// When choose directory button clicked
$(".scan--directory-choose").click(() => {
    // Activate directory chooser
    $(".scan--directory-helper").click()
})

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
                fg(path.join(document.querySelector(".scan--directory").MDCTextField.value, regex ? regex : "/**/*"), {
                    onlyFiles: true
                }).then((files) => {
                    // Make progress bar determinate
                    document.querySelector(".app-progress").MDCLinearProgress.determinate = true

                    // Start progressbar
                    total = files.length;

                    files.forEach((file) => {
                        // If the MD5 hash is in the list
                        if (hashesLoaded) {
scan(file, document.querySelector(".settings--threat-handling").MDCSelect.value).then(() => {
                            done++;
                            document.querySelector(".app-progress").MDCLinearProgress.value = done / total;
                        }, (err) => {
                            if (err) snackBarMessage(`A scanning error occurred: ${err}`)
                        })
                    })
                })
            })
        } else {
            fs.readdir(path.resolve(document.querySelector(".scan--directory").MDCTextField.value), (err, files) => {
                if (err) snackBarMessage(`An error occurred: ${err}`)

                document.querySelector(".app-progress").MDCLinearProgress.determinate = true

                // Start progressbar
                total = files.length

                // For each file
                files.forEach((file) => {
                    // If the MD5 hash is in the list
                    if (hashesLoaded) scan(file, document.querySelector(".settings--threat-handling").MDCSelect.value).then(() => {
                        done++
                        document.querySelector(".app-progress").MDCLinearProgress.value = done / total
                    }, (err) => {
                        snackBarMessage(`A scanning error occurred: ${err}`)
                    })
                })
            })
        }
    })
})

// For each icon button with ripples
$(".mdc-icon-button[data-mdc-auto-init='MDCRipple']").each((_, {
    MDCRipple
}) => {

    // Fix ripples
    MDCRipple.unbounded = true
})


import {
    autoInit
} from "material-components-web"

// Auto init MDC elements
autoInit();

// Provide improved filesystem functions
const fs = require("graceful-fs").gracefulify(require("fs"));

const appIcon = process.platform === "darwin" ? path.join(__dirname, "build", "icons", "mac", "icon.icns") : path.join(__dirname, "build", "icons", "win", "icon.ico");

// Display snackbar message
const snackBarMessage = (message, volume = 0.0) => {
    const snackbar = document.querySelector(".main--snackbar").MDCSnackbar;
    snackbar.close();
    snackbar.labelText = message;
    snackbar.open();
    notifier.notify({
        title: "ROS AV",
        message,
        icon: appIcon,
        sound: false,
    });
    if (volume > 0.0) {
        document.querySelector(".ping").volume = volume;
        document.querySelector(".ping").play();
    }
};

const populateDirectory = (dir) => {
    fs.access(dir, fs.constants.F_OK, (err) => {
        if (err) {
            fs.mkdir(dir, {
                recursive: true,
            }, (err) => {
                if (err) snackBarMessage(`Unable to create application directories. (${err})`);
            });
        }
    });
};

// Set storage location
const storage = path.join((electron.app || electron.remote.app).getPath("appData"), "rosav");

// Set temporary storage location

// Populate storage locations
populateDirectory(storage);
populateDirectory(path.join(storage, "scanning"));
populateDirectory(path.join(storage, "quarantine"));
populateDirectory(path.join(storage, "reports"));
populateDirectory(path.join(storage, "plugins"));

// Initialise storage
db.init({
    dir: path.join(path.join(storage, "settings")),
});

// // Hash list
// let hashes = new BloomFilter(
//     1592401693, // Number of bits to allocate
//     33 // Number of hash functions
// )

// If hashes have loaded
let hashesLoaded = false;

// Hashes loader
const loadHashes = (hashes, hashesparams) => new Promise((resolve) => {
    Promise.all([firstline(hashesparams), firstline(hashes)]).then((val) => {
        resolve(new BloomFilter(JSON.parse(lzjs.decompress(val[1])), parseInt(val[0])));
    });
});

let hashes;

const safe = (dir, hashes) => new Promise((resolve, reject) => {
    fs.lstat(path.resolve(dir), (err, stats) => {
        if (err) reject(err);
        // If path is a directory
        if (stats.isDirectory()) resolve(true);
        // Get the MD5 of a file
        MD5File(path.resolve(dir), (err, hash) => {
            if (err) reject(err);
            // If the hash is in the list
            resolve(!hashes.mightContain(hash));
        });
    });
});

const scan = (dir, action) => new Promise((resolve, reject) => {
    safe(dir, hashes).then((isSafe) => {
        if (!isSafe) {
            if (action === "remove") {
                // Delete the file
                fs.unlink(file, (err) => {
                    if (err) reject(err);
                    snackBarMessage(`${file} was identified as a threat and was deleted.`, 0.1);
                });
            } else if (action === "quarantine") {
                fs.rename(file, path.resolve(path.join(args.data, "quarantine"), path.basename(file)), (err) => {
                    if (err) reject(err);
                    snackBarMessage(`${file} was identified as a threat and was quarantined.`, 0.1);
                    resolve();
                });
            } else {
                resolve();
            }
        }
    }, (err) => {
        reject(err);
    });
});

const userAgent = "Mozilla/5.0 (Windows NT 10.0 WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3163.100 Safari/537.36";
const githubapi = requestTemplate.defaults({
    json: true,
    gzip: true,
    method: "GET",
    headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": userAgent,
    },
});
const request = requestTemplate.defaults({
    gzip: true,
    method: "GET",
    headers: {
        "User-Agent": userAgent,
    },
});

const countFileLines = filePath => new Promise((resolve, reject) => {
    let lineCount = 0;
    fs.createReadStream(filePath)
        .on("data", (buffer) => {
            let idx = -1;
            lineCount--;
            do {
                idx = buffer.indexOf(10, idx + 1);
                lineCount++;
            } while (idx !== -1);
        }).on("end", () => {
            resolve(lineCount);
        }).on("error", reject);
});

const bestForBloom = (n, p) => {
    m = Math.ceil((n * Math.log(p)) / Math.log(1 / (2 ** Math.log(2))));
    k = Math.round((m / n) * Math.log(2));
    return [m, k];
};

const update = (hashes, hashesparams, lastmodified, temphashes) => {
    const self = new EventEmitter();

    // Download latest commit date of hash list
    githubapi("https://api.github.com/repos/Richienb/virusshare-hashes/commits/master", (err, _, {
        commit,
    }) => {
        if (err) self.emit("error", err);

        // Write date to file
        fs.writeFile(lastmodified, commit.author.date, () => {});
    });

    // Download hashlist
    rprog(request("https://media.githubusercontent.com/media/Richienb/virusshare-hashes/master/virushashes.txt"))
        .on("error", (err) => {
            self.emit("error", err);
        })
        .on("progress", ({
            size,
        }) => {
            self.emit("progress", size.transferred / size.total / 2, 1.0);
        })
        .on("end", () => {
            countFileLines(temphashes).then((fileLines) => {
                    const bestFilter = bestForBloom(
                        fileLines, // Number of bits to allocate
                        1e-10, // Number of hash functions (currently set at 1/1 billion)
                    );

                    const hashes = BloomFilter(
                        bestFilter[0],
                        bestFilter[1],
                    );

                    let done = 0;

                    // Line reader
                    const hlr = new LineByLineReader(hashlist, {
                        encoding: "utf8",
                        skipEmptyLines: true,
                    });

                    // Line reader error
                    hlr.on("error", err => self.emit("error", err));

                    // New line from line reader
                    hlr.on("line", (line) => {
                        hashes.add(line);
                        done++;
                        self.emit("progress", done / fileLines + 0.5, 1.0);
                    });

                    // Line reader finished
                    hlr.on("end", () => {
                        fs.writeFile(hashes, lzjs.compress(JSON.stringify([].slice.call(hashes.buckets))), (err) => {
                            if (err) reject(err);
                            fs.writeFile(hashesparams, bestFilter[1].toString(), () => self.emit("end"));
                        });
                    });
                })
                .pipe(fs.createWriteStream(temphashes));

            return self;
        });
};

const checkupdate = (hashlist, lastmodified) => new Promise((resolve, reject) => {
    fs.access(hashlist, fs.constants.F_OK, (err) => {
        if (err) {
resolve({
            fileexists: false,
            outofdate: true,
        });
}
        githubapi("https://api.github.com/rate_limit", (err, _, {
            resources,
        }) => {
            if (err) reject("error", err);

            // Check the quota limit
            if (resources.core.remaining === 0) {
                // If no API quota remaining
                resolve({
                    quota: false,
                    fileexists: true,
                    reset: resources.core.reset,
                    outofdate: false,
                });
            } else {
                // Check for the latest commit
                githubapi("https://api.github.com/repos/Richienb/virusshare-hashes/commits/master", (err, _, {
                    commit,
                }) => {
                    if (err) reject("error", err);

                    // Get download date of hashlist
                    const current = dayjs(lastmodified);

                    // Get latest commit date of hashlist
                    const now = dayjs(commit.author.date, "YYYY-MM-DDTHH:MM:SSZ");

                    // Check if current is older than now
                    resolve({
                        quota: true,
                        fileexists: true,
                        reset: resources.core.reset,
                        outofdate: current.isBefore(now),
                    });
                });
            }
        });
    });
});

checkupdate(path.join(storage, "scanning", "hashlist.lzstring.json"), path.join(storage, "scanning", "lastmodified.txt")).then(({
    outofdate,
}) => {
    if (outofdate === false) {
        loadHashes(path.join(storage, "scanning", "hashlist.lzstring.json"), path.join(storage, "scanning", "hashesparams.txt")).then((out) => {
            hashes = out;
        });
    } else {
        update(path.join(storage, "scanning", "hashlist.lzstring.json"), path.join(storage, "scanning", "hashesparams.txt"), path.join(storage, "scanning", "lastmodified.txt"), path.join(path.join(tempdir, "hashlist.txt"))).on("progress", (done, total) => {
            // Make progress bar determinate
            document.querySelector(".app-progress").MDCLinearProgress.determinate = true;

            // Make progress bar determinate
            document.querySelector(".app-progress").MDCLinearProgress.value = done / total;
        }).on("end", () => {
            loadHashes().then((out) => {
                hashes = out;
                hashesLoaded = true;
            });
        });
    }
});

// Root directory
// const scanDir = path.parse(process.cwd()).root

// Home directory

// Downloads directory

document.querySelector(".scan--directory").MDCTextField.value = scanDir;

let total = 0;
let done = 0;


// Settings manager
const manageSettings = (el, name) => {
    if (el.hasClass("mdc-select")) {
        const mdcSelect = el.get(0).MDCSelect;
        db.getItem(name).then((val) => {
            if (typeof val !== "undefined") mdcSelect.value = val;
            mdcSelect.listen("MDCSelect:change", () => {
                db.setItem(name, mdcSelect.value);
            });
        });
    } else if (el.hasClass("mdc-text-field")) {
        const mdcTextField = el;
        db.getItem(name).then((val) => {
            if (typeof val !== "undefined") mdcTextField.get(0).MDCTextField.value = val;
            mdcTextField.find("input").on("input", () => {
                db.setItem(name, mdcTextField.get(0).MDCTextField.value);
            });
        });
    } else if (el.hasClass("mdc-switch")) {
        const mdcSwitch = el;
        db.getItem(name).then((val) => {
            if (typeof val !== "undefined") mdcSwitch.get(0).MDCSwitch.checked = val;
            mdcSwitch.find(".mdc-switch__native-control").on("change", () => {
                db.setItem(name, mdcSwitch.get(0).MDCSwitch.checked);
            });
        });
    } else {
        snackBarMessage(`Error syncronising ${name}.`);
    }
};

manageSettings($(".settings--update-behaviour"), "update-behaviour");
manageSettings($(".settings--regex-matching"), "regex-matching");
manageSettings($(".settings--rtp"), "rtp");
manageSettings($(".settings--recursive-scan"), "recursive-scan");
manageSettings($(".settings--threat-handling"), "threat-handling");

const watchDir = path.resolve(require("downloads-folder")());
const scanDir = require("os").homedir();
const tempdir = path.join(require("temp-dir"), "rosav");

let watcher;

$(".settings--rtp").find(".mdc-switch__native-control").on("change", () => {
    if (document.querySelector(".settings--rtp").MDCSwitch.checked) {
        watcher = chokidar.watch(watchDir, {
            persistent: true,
        });

        watcher
            .on("add", (dir) => {
                if (hashesLoaded) {
 scan(dir, document.querySelector(".settings--threat-handling").MDCSelect.value).then(() => {}, (err) => {
                    if (err) snackBarMessage(`A scanning error occurred: ${err}`);
                });
}
            })
            .on("change", (dir) => {
                if (hashesLoaded) {
scan(dir, document.querySelector(".settings--threat-handling").MDCSelect.value).then(() => {}, (err) => {
                    if (err) snackBarMessage(`A scanning error occurred: ${err}`);
                });
}
            })
            .on("error", (err) => {
                if (err.code = "EPERM") {
                    console.warn(`Not enough permissions provided to watch a directory. Please run ROS AV as an administrator (${err.message})`);
                } else {
                    snackBarMessage(`An real time protection error occurred: ${err}`);
                }
            });
    } else if (watcher.close) watcher.close();
});

$(".settings--rtp").find(".mdc-switch__native-control").trigger("change");

// Execute plugins
fs.readdir(path.join(storage, "plugins"), (err, items) => {
    if (err) snackBarMessage(`Failed to load plugins because ${err}`);

    // If no plugins installed
    if (!items) return;

    items.forEach((dir) => {
        if (dir.endsWith(".js")) {
            fs.readFile(path.join(storage, "plugins", dir), "utf8", (err, contents) => {
                if (err) {
                    snackBarMessage(`Failed to load ${dir} because ${err}`);
                } else {
                    try {
                        (() => {
                            eval(contents);
                        })();
                    } catch (err) {
                        snackBarMessage(`Failed to load ${dir} because ${err}`);
                    }
                    snackBarMessage(`Successfully loaded ${dir}`);
                }
            });
        }
    });
});

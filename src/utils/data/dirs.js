import path from "path"

import tempDir from "temp-dir"
import os from "os"
import downloadsFolder from "downloads-folder"
import electron from "electron"

export default {
    rootdir: path.parse(process.cwd()).root, // Root directory
    tempdir: path.join(tempDir, "rosav"), // Temporary directory
    homedir: os.homedir(), // Home directory
    downdir: path.resolve(downloadsFolder()), // Downloads directory
    storedir: path.join((electron.app || electron.remote.app).getPath("appData"), "rosav"), // Storage directory
}

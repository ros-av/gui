import path from "path"

const baseIconPath = path.resolve(__dirname, "..", "..", "..", "build", "icons")

export default process.platform === "darwin" ? path.join(baseIconPath, "mac", "icon.icns") : path.join(baseIconPath, "win", "icon.ico")

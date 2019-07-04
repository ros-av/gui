import path from "path"

import notifier from "node-notifier"

import appIcon from "../utils/data/appIcon"

// Ping sound
const pingSound = new Audio(path.resolve(__dirname, "..", "ping.ogg"))

// Display snackbar message
export default (message, volume = 1) => {
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
        const audio = pingSound.cloneNode()
        audio.volume = volume
        audio.play()
    }
}

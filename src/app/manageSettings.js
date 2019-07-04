import Store from "electron-store"

const db = new Store({
    cwd: "settings",
    encryptionKey: "hCjBXNalGSdrRNftsbvQnXzJhToSKVNp",
})

import snackBarMessage from "./snackBarMessage"

export default async (el, name) => {
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

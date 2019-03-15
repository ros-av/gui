// Modules to control application life and create native browser window
const {
    app,
    Menu,
    Tray,
    BrowserWindow
} = require('electron')

app.commandLine.appendSwitch('--autoplay-policy', 'no-user-gesture-required')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 960,
        height: 680,
        icon: 'icon.ico',
        frame: false,
        resizable: false
    })

    mainWindow.on('minimize', event => {
        event.preventDefault()
        mainWindow.hide()
    })

    mainWindow.on('close', event => {
        if (!app.isQuiting) {
            event.preventDefault()
            mainWindow.hide()
        }

        return false
    })

    tray = new Tray('icon.ico')

    const contextMenu = Menu.buildFromTemplate([{
            label: 'Open ROS AV',
            click() {
                mainWindow.show()
            }
        },
        {
            label: 'Quit ROS AV',
            click() {
                app.isQuiting = true
                app.quit()
            }
        }
    ])

    tray.on('click', () => {
        tray.popUpContextMenu()
    })

    tray.setToolTip('ROS AV')
    tray.setContextMenu(contextMenu)

    // and load the index.html of the app.
    mainWindow.loadFile('index.html')

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

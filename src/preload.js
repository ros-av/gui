const {
    remote,
} = require("electron");

remote.getCurrentWebContents().once('dom-ready', () => {
    require("electron-compile/lib/initialize-renderer").initializeRendererProcess(remote.getGlobal("globalCompilerHost").readOnlyMode);

    require("./app.js");
});

const { join } = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");

app.whenReady().then(async () => {
    const MainWindow = new BrowserWindow({
        width: 380,
        height: 500,
        show: false,
        center: true,
        darkTheme: true,
        resizable: false,
        maximizable: false,
        useContentSize: true,
        fullscreenable: false,
        autoHideMenuBar: true,
        backgroundColor: "#000",
        icon: join(__dirname, 'static', 'icons', 'icon.ico'),
        webPreferences: { devtools: !app.isPackaged, nodeIntegration: true, preload: join(__dirname, 'static', 'js', 'jQuery.Manager.js') }
    });
    ipcMain.handle("SetSize",
        (i, width, height) => { MainWindow.setContentSize(width, height); MainWindow.center(); });

    MainWindow.setContentProtection(true);
    await MainWindow.loadFile(join(__dirname, 'static', 'index.html')); MainWindow.show();
});
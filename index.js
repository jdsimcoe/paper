'use strict';
const path = require('path');
const fs = require('fs');
const electron = require('electron');
const appMenu = require('./menu');
const config = require('./config');
const tray = require('./tray');
const app = electron.app;

require('electron-debug')();
require('electron-dl')();
require('electron-context-menu')();

let mainWindow;
let isQuitting = false;

const isAlreadyRunning = app.makeSingleInstance(() => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}

		mainWindow.show();
	}
});

if (isAlreadyRunning) {
	app.quit();
}

function updateBadge(title) {
	// ignore `Sindre messaged you` blinking
	if (title.indexOf('Paper') === -1) {
		return;
	}

	let messageCount = (/\(([0-9]+)\)/).exec(title);
	messageCount = messageCount ? Number(messageCount[1]) : 0;

	if (process.platform === 'darwin' || process.platform === 'linux') {
		app.setBadgeCount(messageCount);
	}

	if (process.platform === 'linux' || process.platform === 'win32') {
		tray.setBadge(messageCount);
	}
}

function createMainWindow() {
	const lastWindowState = config.get('lastWindowState');

	const win = new electron.BrowserWindow({
		title: app.getName(),
		show: false,
		x: lastWindowState.x,
		y: lastWindowState.y,
		width: lastWindowState.width,
		height: lastWindowState.height,
		icon: process.platform === 'linux' && path.join(__dirname, 'static/Icon.png'),
		minWidth: 768,
		minHeight: 600,
		alwaysOnTop: config.get('alwaysOnTop'),
		titleBarStyle: 'hidden-inset',
		autoHideMenuBar: true,
		webPreferences: {
			// preload: path.join(__dirname, 'browser.js'),
			nodeIntegration: false,
			plugins: true
		}
	});

	if (process.platform === 'darwin') {
		win.setSheetOffset(40);
	}

	win.loadURL('https://paper.dropbox.com/');

	win.on('close', e => {
		if (!isQuitting) {
			e.preventDefault();

			if (process.platform === 'darwin') {
				app.hide();
			} else {
				win.hide();
			}
		}
	});

  win.on('app-command', (e, cmd) => {

})

	win.on('page-title-updated', (e, title) => {
		e.preventDefault();
		updateBadge(title);
	});

	return win;
}

app.on('ready', () => {
	electron.Menu.setApplicationMenu(appMenu);
	mainWindow = createMainWindow();
	tray.create(mainWindow);

	const page = mainWindow.webContents;

	const argv = require('minimist')(process.argv.slice(1));

  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.executeJavaScript(`
      document.body.classList.add("fullscreen")
    `);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.executeJavaScript(`
      document.body.classList.remove("fullscreen")
    `);
  });

	page.on('dom-ready', () => {
		page.insertCSS(fs.readFileSync(path.join(__dirname, 'browser.css'), 'utf8'));

		if (argv.minimize) {
			mainWindow.minimize();
		} else {
			mainWindow.show();
		}
	});

	page.on('new-window', (e, url) => {
		e.preventDefault();
		electron.shell.openExternal(url);
	});
});

app.on('activate', () => {
	mainWindow.show();

});

app.on('before-quit', () => {
	isQuitting = true;

	if (!mainWindow.isFullScreen()) {
		config.set('lastWindowState', mainWindow.getBounds());
	}
});

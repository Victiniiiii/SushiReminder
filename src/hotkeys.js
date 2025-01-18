import { getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

const appWindow = getCurrentWindow();

export const registerHotkeys = async () => {
	register(`Shift+Alt+${localStorage.getItem("focusHideHotkey")}`, async (event) => {
		if (event.state === "Pressed") {
			const isWindowMinimized = await appWindow.isMinimized();
			const isWindowVisible = await appWindow.isVisible();
			if (isWindowMinimized || !isWindowVisible) {
				appWindow.unminimize();
				appWindow.show();
				appWindow.setFocus();
			} else {
				appWindow.minimize();
			}
		}
	});
	register(`Shift+Alt+${localStorage.getItem("quitHotkey")}`, (event) => {
		if (event.state === "Pressed") {
			appWindow.destroy();
		}
	});
};

export const focusHideHotkeyFunction = () => {
	const input = prompt("Enter the hotkey for focusing and hiding app. Will be use with Shift + Alt.", localStorage.getItem("focusHideHotkey"));
	if (input) setFocusHideHotkey(input);
	unregister(`Shift+Alt+${localStorage.getItem("focusHideHotkey")}`);
	register(`Shift+Alt+${input}`, async (event) => {
		if (event.state === "Pressed") {
			const isWindowMinimized = await appWindow.isMinimized();
			const isWindowVisible = await appWindow.isVisible();
			if (isWindowMinimized || !isWindowVisible) {
				appWindow.unminimize();
				appWindow.show();
				appWindow.setFocus();
			} else {
				appWindow.minimize();
			}
		}
	});
	localStorage.setItem("focusHideHotkey", input);
};

export const quitHotkeyFunction = () => {
	const input = prompt("Enter the hotkey for quitting app. Will be use with Shift + Alt.", localStorage.getItem("quitHotkey"));
	if (input) setQuitHotkey(input);
	unregister(`Shift+Alt+${localStorage.getItem("quitHotkey")}`);
	register(`Shift+Alt+${input}`, (event) => {
		if (event.state === "Pressed") {
			appWindow.destroy();
		}
	});
	localStorage.setItem("quitHotkey", input);
};

import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

const appWindow = getCurrentWindow();

export const useHotkeys = () => {
	const [focusHideHotkey, setFocusHideHotkey] = useState(() => {
		const storedHotkey = localStorage.getItem("focusHideHotkey");
		if (!storedHotkey) {
			localStorage.setItem("focusHideHotkey", "R");
			return "R";
		}
		return storedHotkey;
	});

	const [quitHotkey, setQuitHotkey] = useState(() => {
		const storedQuitHotkey = localStorage.getItem("quitHotkey");
		if (!storedQuitHotkey) {
			localStorage.setItem("quitHotkey", "T");
			return "T";
		}
		return storedQuitHotkey;
	});

	useEffect(() => {
		registerHotkeys();
		return () => {
			unregister(`Shift+Alt+${focusHideHotkey}`);
			unregister(`Shift+Alt+${quitHotkey}`);
		};
	}, [focusHideHotkey, quitHotkey]);

	const registerHotkeys = async () => {
		register(`Shift+Alt+${focusHideHotkey}`, async (event) => {
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
		register(`Shift+Alt+${quitHotkey}`, (event) => {
			if (event.state === "Pressed") {
				appWindow.destroy();
			}
		});
	};

	const focusHideHotkeyFunction = () => {
		const input = prompt("Enter the hotkey for focusing and hiding app. Will be used with Shift + Alt.", focusHideHotkey);
		if (input) {
			unregister(`Shift+Alt+${focusHideHotkey}`);
			setFocusHideHotkey(input);
			localStorage.setItem("focusHideHotkey", input);
			registerHotkeys();
		}
	};

	const quitHotkeyFunction = () => {
		const input = prompt("Enter the hotkey for quitting app. Will be used with Shift + Alt.", quitHotkey);
		if (input) {
			unregister(`Shift+Alt+${quitHotkey}`);
			setQuitHotkey(input);
			localStorage.setItem("quitHotkey", input);
			registerHotkeys();
		}
	};

	return { focusHideHotkeyFunction, quitHotkeyFunction };
};

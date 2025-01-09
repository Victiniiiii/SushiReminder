import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

const trayShow = async () => {
	await appWindow.setFocus();
};

// two u's in the menu fixed a bug for some reason
const menuu = await Menu.new({
	items: [
		{
			id: "show",
			text: "Show",
			action: async () => {
				await trayShow();
			},
		},
		{
			id: "quit",
			text: "Quit",
			action: () => {
				while (TrayIcon) {
					TrayIcon.destroy;
				}
				appWindow.destroy();
			},
		},
	],
});

export const options = {
	icon: await defaultWindowIcon(),
	menuu,
    menuOnLeftClick: true,
};

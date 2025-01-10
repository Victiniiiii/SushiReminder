import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

// two u's in the menu fixed a bug for some reason
const menu = await Menu.new({
	items: [
		{
			id: "show",
			text: "Show",
			action: () => {
				appWindow.show();
			},
		},
		{
			id: "quit",
			text: "Quit",
			action: () => {
				appWindow.destroy();
			},
		},
	],
});

export const options = {
	icon: await defaultWindowIcon(),
	menu,
	menuOnLeftClick: false,
};

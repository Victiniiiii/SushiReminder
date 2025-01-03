import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Menu } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

const trayShow = async () => {
	await appWindow.setFocus();
};

const menu = await Menu.new({
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

import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { BaseDirectory } from "@tauri-apps/plugin-fs";
import { sendNotification } from "@tauri-apps/plugin-notification";

export const ensurePermission = async () => {
	if (!await isPermissionGranted(BaseDirectory.Desktop)) {
		if (!await requestPermission(BaseDirectory.Desktop)) {
			alert("File system permission denied.");
		}
	}
};

export const notifyTheUser = (title, body) => {
	sendNotification({ title, body });
};
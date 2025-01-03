import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { BaseDirectory } from "@tauri-apps/plugin-fs";

export const ensurePermission = async () => {
	if (!await isPermissionGranted(BaseDirectory.Desktop)) {
		if (!await requestPermission(BaseDirectory.Desktop)) {
			alert("File system permission denied.");
		}
	}
};
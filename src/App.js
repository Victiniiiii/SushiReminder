import React, { useEffect } from "react";
import "./App.css";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

function App() {
	useEffect(() => {
		let permissionGranted = isPermissionGranted();

		if (!permissionGranted) {
			const permission = requestPermission();
			permissionGranted = permission === "granted";
		}

		if (permissionGranted) {
			sendNotification({ title: "Tauri", body: "Tauri is awesome!" });
		}
	}, []);

	return (
		<div className="App">
			<h1>Welcome to Tauri!</h1>
			<p>This is a sample app with desktop notifications.</p>
		</div>
	);
}

export default App;

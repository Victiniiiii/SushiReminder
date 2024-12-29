import React, { useEffect } from "react";
import "./App.css";
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/api/notification';

function App() {
	/* useEffect(() => {
		if (Notification.permission !== "granted") {
			Notification.requestPermission();
		}

		window.tauri.listen("send-notification", (message) => {
			new Notification("Tauri Notification", {
				body: message,
				icon: "path/to/icon.png",
			});
		});
	}, []); */

	return (
		<div className="App">
			<h1>Welcome to Tauri!</h1>
			<p>This is a sample app with desktop notifications.</p>
		</div>
	);
}

export default App;

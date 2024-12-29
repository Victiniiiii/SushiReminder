import React, { useEffect, useState } from "react";
import "./App.css";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

const App = () => {
	const [activeTab, setActiveTab] = useState("one-time");

	const renderTabContent = () => {
		switch (activeTab) {
			case "one-time":
				return (
					<div className="tab-content">
						<h2>One-Time Reminders</h2>
						<button className="create-button">Create Reminder</button>
					</div>
				);
			case "repeated":
				return (
					<div className="tab-content">
						<h2>Repeated Reminders</h2>
						<button className="create-button">Create Reminder</button>
					</div>
				);
			case "settings":
				return (
					<div className="tab-content">
						<h2>Settings</h2>
						<p>Configure your preferences here.</p>
					</div>
				);
			default:
				return null;
		}
	};

	return (
		<div className="app">
			<header className="header">
				<h1>Remindauri</h1>
			</header>
			<nav className="tabs">
				<button className={activeTab === "one-time" ? "active" : ""} onClick={() => setActiveTab("one-time")}>
					One-Time Reminders
				</button>
				<button className={activeTab === "repeated" ? "active" : ""} onClick={() => setActiveTab("repeated")}>
					Repeated Reminders
				</button>
				<button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}>
					Settings
				</button>
			</nav>
			<main>{renderTabContent()}</main>
		</div>
	);
};

export default App;

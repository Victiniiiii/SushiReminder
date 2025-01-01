import React, { useState, useEffect } from "react";
import "./App.css";
import { readTextFile, writeTextFile, BaseDirectory, create, exists } from "@tauri-apps/plugin-fs";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { ensurePermission } from "./permission.js";

const App = () => {
	const [activeTab, setActiveTab] = useState("one-time");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [reminderType, setReminderType] = useState("one-time");
	const [reminders, setReminders] = useState({ oneTime: [], repeated: [] });
	const [reminderData, setReminderData] = useState({
		name: "",
		date: "",
		time: "",
		repeatFrequency: "hourly",
		repeatTime: "",
		resetMode: "manual",
	});

	useEffect(() => {
		const loadReminders = async () => {
			await ensurePermission();
			try {
				if (await exists("reminders.json", { baseDir: BaseDirectory.Desktop })) {
					setReminders(JSON.parse(await readTextFile("reminders.json", { baseDir: BaseDirectory.Desktop })));
				} else {
					const initialData = JSON.stringify({ oneTime: [], repeated: [] });
					await writeTextFile("reminders.json", initialData, { baseDir: BaseDirectory.Desktop });
					setReminders(JSON.parse(initialData));
				}
			} catch (e) {
				console.error(e);
			}
		};
		loadReminders();
	}, []);

	const handleCreateReminder = async () => {
		const newReminder = { ...reminderData };

		if (reminderType === "one-time") {
			const selectedDateTime = new Date(`${newReminder.date}T${newReminder.time}`);
			const now = new Date();

			if (isNaN(selectedDateTime.getTime())) {
				alert("Error: The provided date and time are invalid.");
				return;
			} else if (selectedDateTime < now) {
				alert("Error: You cannot set a reminder in the past.");
				return;
			}
		}

		const updatedReminders = { ...reminders };

		if (reminderType === "one-time") {
			updatedReminders.oneTime.push(newReminder);
		} else {
			updatedReminders.repeated.push(newReminder);
		}

		setReminders(updatedReminders);
		await writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Desktop });

		setIsModalOpen(false);
		setReminderData({
			name: "",
			date: "",
			time: "",
			repeatFrequency: "hourly",
			repeatTime: "",
		});
	};

	const formatDateTime = (date, time) => {
		const dateObj = new Date(`${date}T${time}`);
		const options = {
			hour: "2-digit",
			minute: "2-digit",
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		};
		return dateObj.toLocaleString(undefined, options).replace(",", "");
	};

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setReminderData((prev) => ({ ...prev, [name]: value }));
	};

	const renderModalContent = () => {
		return (
			<div className="modal">
				<div className="modal-content">
					<h2>Create Reminder</h2>
					<label>
						Reminder Name:
						<input type="text" name="name" value={reminderData.name} onChange={handleInputChange} />
					</label>
					<label>
						Reminder Type:
						<select value={reminderType} onChange={(e) => setReminderType(e.target.value)}>
							<option value="one-time">One-Time</option>
							<option value="repeated">Repeated</option>
						</select>
					</label>
					{reminderType === "one-time" && (
						<>
							<label>
								Date:
								<input type="date" name="date" value={reminderData.date} onChange={handleInputChange} />
							</label>
							<label>
								Time:
								<input type="time" name="time" value={reminderData.time} onChange={handleInputChange} />
							</label>
						</>
					)}
					{reminderType === "repeated" && (
						<>
							<label>
								Frequency:
								<select name="repeatFrequency" value={reminderData.repeatFrequency} onChange={handleInputChange}>
									<option value="hourly">Hourly</option>
									<option value="daily">Daily</option>
									<option value="weekly">Weekly</option>
									<option value="monthly">Monthly</option>
									<option value="yearly">Yearly</option>
								</select>
							</label>
							<label>
								Time:
								<input type="time" name="repeatTime" value={reminderData.repeatTime} onChange={handleInputChange} />
							</label>
							<label>
								Reset Mode:
								<select name="resetMode" value={reminderData.resetMode} onChange={handleInputChange}>
									<option value="manual">Manual</option>
									<option value="automatic">Automatic</option>
								</select>
							</label>
						</>
					)}
					<div className="modal-actions">
						<button onClick={handleCreateReminder}>Save</button>
						<button onClick={() => setIsModalOpen(false)}>Cancel</button>
					</div>
				</div>
			</div>
		);
	};

	const renderTabContent = () => {
		switch (activeTab) {
			case "one-time":
				return (
					<div className="tab-content">
						<h2>One-Time Reminders</h2>
						<button className="create-button" onClick={() => setIsModalOpen(true)}>
							Create Reminder
						</button>
						<ul>
							{reminders.oneTime.map((reminder, index) => (
								<li key={index}>
									{reminder.name} - {formatDateTime(reminder.date, reminder.time)}
								</li>
							))}
						</ul>
					</div>
				);
			case "repeated":
				return (
					<div className="tab-content">
						<h2>Repeated Reminders</h2>
						<button className="create-button" onClick={() => setIsModalOpen(true)}>
							Create Reminder
						</button>
						<ul>
							{reminders.repeated.map((reminder, index) => (
								<li key={index}>
									{reminder.name} - {reminder.repeatFrequency} at {formatDateTime(reminder.date || "", reminder.repeatTime)}
									{reminder.resetMode === "manual" && <button onClick={console.log("TODO")}>Reset TODO</button>}
								</li>
							))}
						</ul>
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
			{isModalOpen && renderModalContent()}
		</div>
	);
};

export default App;

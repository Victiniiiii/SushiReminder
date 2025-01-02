import React, { useState, useEffect } from "react";
import "./App.css";
import { readTextFile, writeTextFile, BaseDirectory, exists } from "@tauri-apps/plugin-fs";
import { ensurePermission, notifyTheUser } from "./permissionnotification.js";

const App = () => {
	const [activeTab, setActiveTab] = useState("one-time");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [reminderType, setReminderType] = useState("one-time");
	const [reminders, setReminders] = useState({ oneTime: [], repeated: [] });
	const [countdowns, setCountdowns] = useState({});
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

	useEffect(() => {
		const interval = setInterval(() => {
			const now = new Date();
			const updatedCountdowns = { ...countdowns };

			reminders.oneTime.forEach((reminder, index) => {
				const reminderTime = new Date(`${reminder.date}T${reminder.time}`);
				if (now > reminderTime) {
					updatedCountdowns[index] = { time: "Time's up!", notified: true };
				} else {
					const timeDiff = reminderTime - now;
					updatedCountdowns[index] = { time: formatCountdown(timeDiff), notified: false };
				}
			});

			reminders.repeated.forEach((reminder, index) => {
				const nextOccurrence = getNextOccurrence(reminder);
				const timeDiff = nextOccurrence - now;
				if (timeDiff <= 0) {
					updatedCountdowns[index] = { time: "Time's up!", notified: true };
				} else {
					updatedCountdowns[index] = { time: formatCountdown(timeDiff), notified: false };
				}
			});

			setCountdowns(updatedCountdowns);
			writeTextFile("reminders.json", JSON.stringify(reminders), { baseDir: BaseDirectory.Desktop });
		}, 1000);

		return () => clearInterval(interval);
	}, [reminders, countdowns]);

	const getNextOccurrence = (reminder) => {
		const now = new Date();
		let nextOccurrence = new Date(now);

		const reminderTime = reminder.repeatTime.split(":");
		const reminderHour = parseInt(reminderTime[0]);
		const reminderMinute = parseInt(reminderTime[1]);

		if (reminder.repeatFrequency === "hourly") {
			if (now.getHours() > reminderHour || (now.getHours() === reminderHour && now.getMinutes() >= reminderMinute)) {
				nextOccurrence.setHours(now.getHours() + 1, reminderMinute, 0, 0);
			} else {
				nextOccurrence.setHours(reminderHour, reminderMinute, 0, 0);
			}
		}

		if (reminder.repeatFrequency === "daily") {
			nextOccurrence.setDate(now.getDate() + 1);
			nextOccurrence.setHours(reminderHour, reminderMinute, 0, 0);
		} else if (reminder.repeatFrequency === "weekly") {
			nextOccurrence.setDate(now.getDate() + 7);
			nextOccurrence.setHours(reminderHour, reminderMinute, 0, 0);
		} else if (reminder.repeatFrequency === "monthly") {
			nextOccurrence.setMonth(now.getMonth() + 1);
			nextOccurrence.setHours(reminderHour, reminderMinute, 0, 0);
		} else if (reminder.repeatFrequency === "yearly") {
			nextOccurrence.setFullYear(now.getFullYear() + 1);
			nextOccurrence.setHours(reminderHour, reminderMinute, 0, 0);
		}

		return nextOccurrence;
	};

	const handleCreateReminder = async () => {
		const newReminder = { ...reminderData, notified: false };

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
			resetMode: "manual",
		});
	};

	const formatDateTime = (date, time) => {
		if (!date && time) {
			const [hours, minutes] = time.split(":");
			const now = new Date();
			now.setHours(hours, minutes, 0, 0);
			return now.toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
			});
		} else if (date && time) {
			const dateObj = new Date(`${date}T${time}`);
			const options = {
				hour: "2-digit",
				minute: "2-digit",
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
			};
			return dateObj.toLocaleString(undefined, options).replace(",", "");
		}
		return "Invalid Date";
	};

	const formatCountdown = (timeDiff) => {
		const hours = Math.floor((timeDiff / (1000 * 60 * 60)) % 24);
		const minutes = Math.floor((timeDiff / (1000 * 60)) % 60);
		const seconds = Math.floor((timeDiff / 1000) % 60);

		return `${hours}h ${minutes}m ${seconds}s`;
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
		const now = new Date();

		switch (activeTab) {
			case "one-time":
				return (
					<div className="tab-content">
						<h2>One-Time Reminders</h2>
						{reminders.oneTime.map((reminder, index) => {
							const reminderDate = new Date(`${reminder.date}T${reminder.time}`);
							const isPastDue = now > reminderDate;
							return (
								<div key={index}>
									{reminder.name} - {isPastDue ? "Time's up!" : formatDateTime(reminder.date, reminder.time)} {!isPastDue ? "- " + countdowns[index]?.time || "- Calculating..." : ""}
								</div>
							);
						})}
					</div>
				);
			case "repeated":
				return (
					<div className="tab-content">
						<h2>Repeated Reminders</h2>
						{reminders.repeated.map((reminder, index) => (
							<div key={index}>
								{reminder.name} - {formatDateTime("", reminder.repeatTime)} - {countdowns[index]?.time || "Calculating..."}
								{reminder.resetMode === "manual" && <button onClick={() => console.log("Reset TODO")}>Reset TODO</button>}
							</div>
						))}
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
				<button className="create-button" onClick={() => setIsModalOpen(true)}>
					Create Reminder
				</button>
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

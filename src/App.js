import React, { useState, useEffect } from "react";
import "./App.css";
import { v4 as uuidv4 } from "uuid";
import { readTextFile, writeTextFile, BaseDirectory, exists } from "@tauri-apps/plugin-fs";
import { ensurePermission } from "./permissions.js";
import { options } from "./systemTray.js";
import { TrayIcon } from "@tauri-apps/api/tray";
import { sendNotification } from "@tauri-apps/plugin-notification";

const App = () => {
	const [activeTab, setActiveTab] = useState("one-time");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [reminderType, setReminderType] = useState("one-time");
	const [trayExists, setTrayExists] = useState(false);
	const [reminders, setReminders] = useState({ oneTime: [], repeated: [] });
	const [countdowns, setCountdowns] = useState({});
	const [oneTimeCountdowns, setOneTimeCountdowns] = useState({});
	const [repeatedCountdowns, setRepeatedCountdowns] = useState({});
	const [reminderData, setReminderData] = useState({
		name: "",
		date: "",
		time: "",
		repeatFrequency: "hourly",
		repeatTime: "",
		resetMode: "manual",
		customInterval: "",
	});

	useEffect(() => {
		const loadReminders = async () => {
			if (!trayExists) {
				await TrayIcon.new(options);
				setTrayExists(true);
			}
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

			const newOneTimeCountdowns = { ...oneTimeCountdowns };
			reminders.oneTime.forEach((reminder) => {
				const reminderTime = new Date(`${reminder.date}T${reminder.time}`);
				const timeDiff = reminderTime - now;

				if (timeDiff <= 1000) {
					newOneTimeCountdowns[reminder.id] = "Time's up!";
					if (!reminder.notified) {
						sendNotification(`Reminder: ${reminder.name}`);
						reminder.notified = true;
					}
				} else {
					newOneTimeCountdowns[reminder.id] = formatCountdown(timeDiff);
				}
			});
			setOneTimeCountdowns(newOneTimeCountdowns);

			const newRepeatedCountdowns = { ...repeatedCountdowns };
			const updatedReminders = { ...reminders };

			reminders.repeated.forEach((reminder) => {
				const nextOccurrence = getNextOccurrence(reminder);
				const timeDiff = nextOccurrence - now;

				console.log(timeDiff);

				if (timeDiff <= 1000) {
					const handleReminderRestart = async () => {
						if (!reminder.notified) {
							sendNotification(`Reminder: ${reminder.name}`);
							reminder.notified = true;
						}

						if (reminder.resetMode === "automatic") {
							const newNextOccurrence = getNextOccurrence(reminder, true);
							newRepeatedCountdowns[reminder.id] = formatCountdown(newNextOccurrence - now);
							reminder.checked = false;
						} else {
							newRepeatedCountdowns[reminder.id] = "Time's up!";
						}

						reminder.notified = false;
					};
					handleReminderRestart();
				} else if (!(newRepeatedCountdowns[reminder.id] == "Time's up!")) {
					newRepeatedCountdowns[reminder.id] = formatCountdown(timeDiff);
				}
			});

			setRepeatedCountdowns(newRepeatedCountdowns);
			setReminders(updatedReminders);

			writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Desktop });
		}, 1000);

		return () => clearInterval(interval);
	}, [reminders, oneTimeCountdowns, repeatedCountdowns]);

	const getNextOccurrence = (reminder) => {
		const now = new Date();
		let nextOccurrence = new Date(now);

		const reminderTime = reminder.repeatTime.split(":");
		const reminderHour = parseInt(reminderTime[0]);
		const reminderMinute = parseInt(reminderTime[1]);

		if (reminder.repeatFrequency === "hourly") {
			if (reminder.customInterval) {
				nextOccurrence.setHours(now.getHours() + parseInt(reminder.customInterval), reminderMinute, 0, 0);
			} else if (now.getHours() > reminderHour || (now.getHours() === reminderHour && now.getMinutes() >= reminderMinute)) {
				nextOccurrence.setHours(now.getHours() + 1, reminderMinute, 0, 0);
			} else {
				nextOccurrence.setHours(reminderHour, reminderMinute, 0, 0);
			}
		} else if (reminder.repeatFrequency === "daily") {
			if (reminder.customInterval) {
				nextOccurrence.setDate(now.getDate() + parseInt(reminder.customInterval));
				nextOccurrence.setHours(reminderHour, reminderMinute, 0, 0);
			} else {
				nextOccurrence.setDate(now.getDate() + 1);
				nextOccurrence.setHours(reminderHour, reminderMinute, 0, 0);
			}
		} else if (reminder.repeatFrequency === "weekly") {
			const daysOfWeek = [];
			for (let i = 0; i < 7; i++) {
				if (reminder[`day-${i}`]) {
					daysOfWeek.push(i);
				}
			}

			let daysToAdd = 0;
			let validDayFound = false;

			while (true) {
				const candidateDate = new Date(now);
				candidateDate.setDate(candidateDate.getDate() + daysToAdd);
				const dayOfWeek = candidateDate.getDay();

				if (daysOfWeek.includes(dayOfWeek)) {
					if (daysToAdd === 0) {
						const [reminderHour, reminderMinute] = reminder.repeatTime.split(":").map(Number);
						if (reminderHour > now.getHours() || (reminderHour === now.getHours() && reminderMinute > now.getMinutes())) {
							validDayFound = true;
							nextOccurrence = candidateDate;
						}
					} else {
						validDayFound = true;
						nextOccurrence = candidateDate;
					}
				}

				if (validDayFound) {
					nextOccurrence.setHours(reminderHour, reminderMinute, 0, 0);
					break;
				}

				daysToAdd++;
			}
		} else if (reminder.repeatFrequency === "monthly") {
			nextOccurrence.setMonth(now.getMonth() + 1);
			nextOccurrence.setHours(reminderHour, reminderMinute, 0, 0);
		} else if (reminder.repeatFrequency === "yearly") {
			const repeatDateParts = reminder.repeatDate.split("-");
			const repeatYear = now.getFullYear();
			const repeatMonth = parseInt(repeatDateParts[1]) - 1;
			const repeatDay = parseInt(repeatDateParts[2]);

			nextOccurrence.setFullYear(repeatYear);
			nextOccurrence.setMonth(repeatMonth);
			nextOccurrence.setDate(repeatDay);
			nextOccurrence.setHours(reminderHour, reminderMinute, 0, 0);

			if (nextOccurrence < now) {
				nextOccurrence.setFullYear(repeatYear + 1);
			}
		}

		return nextOccurrence;
	};

	const getDayOfWeek = (date) => {
		const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		return days[date.getDay()];
	};

	const handleCreateReminder = async () => {
		const newReminder = { ...reminderData, id: uuidv4(), notified: false };

		if (newReminder.name === "") {
			alert("Please give a name to this reminder.");
			return;
		}

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
			customInterval: "",
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
		const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((timeDiff / (1000 * 60 * 60)) % 24);
		const minutes = Math.floor((timeDiff / (1000 * 60)) % 60);
		const seconds = Math.floor((timeDiff / 1000) % 60);

		if (days > 0) {
			return `${days}d ${hours}h ${minutes}m ${seconds}s`;
		} else {
			return `${hours}h ${minutes}m ${seconds}s`;
		}
	};

	const handleInputChange = (e) => {
		const { name, value, type, checked } = e.target;

		if (type === "checkbox") {
			setReminderData((prev) => ({ ...prev, [name]: checked }));
		} else {
			setReminderData((prev) => ({ ...prev, [name]: value }));
		}
	};

	const renderModalContent = () => {
		const currentDate = new Date().toISOString().split("T")[0];
		const currentTime = new Date().toISOString().split("T")[1].slice(0, 5);

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
								<input type="date" name="date" value={reminderData.date || currentDate} onChange={handleInputChange} />
							</label>
							<label>
								Time:
								<input type="time" name="time" value={reminderData.time || currentTime} onChange={handleInputChange} />
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
							{reminderData.repeatFrequency === "hourly" || reminderData.repeatFrequency === "daily" ? (
								<>
									<label>
										Time:
										<input type="time" name="repeatTime" value={reminderData.repeatTime || currentTime} onChange={handleInputChange} />
									</label>
									<label>
										Custom Interval (in hours/days):
										<input type="number" name="customInterval" value={reminderData.customInterval || 1} onChange={handleInputChange} min="1" />
									</label>
								</>
							) : null}
							{reminderType === "repeated" && reminderData.repeatFrequency === "weekly" && (
								<>
									<label>Which days to repeat:</label>
									<div>
										{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => (
											<label key={index}>
												<input type="checkbox" name={`day-${index}`} checked={reminderData[`day-${index}`] || false} onChange={handleInputChange} />
												{day}
											</label>
										))}
									</div>
									<label>
										Custom Interval (in hours/days):
										<input type="number" name="customInterval" value={reminderData.customInterval || 1} onChange={handleInputChange} min="1" />
									</label>
									<label>
										Time:
										<input type="time" name="repeatTime" value={reminderData.repeatTime || currentTime} onChange={handleInputChange} />
									</label>
								</>
							)}
							{reminderType === "repeated" && reminderData.repeatFrequency === "monthly" && (
								<>
									<label>
										Select Date:
										<input type="date" name="repeatDate" value={reminderData.repeatDate || currentDate} onChange={handleInputChange} />
									</label>
									<label>
										Time:
										<input type="time" name="repeatTime" value={reminderData.repeatTime || currentTime} onChange={handleInputChange} />
									</label>
								</>
							)}
							{reminderType === "repeated" && reminderData.repeatFrequency === "yearly" && (
								<>
									<label>Yearly Reminder Date:</label>
									<input type="date" name="repeatDate" value={reminderData.repeatDate || currentDate} onChange={handleInputChange} />
									<label>Time:</label>
									<input type="time" name="repeatTime" value={reminderData.repeatTime || currentTime} onChange={handleInputChange} />
								</>
							)}
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

		const handleDeleteReminder = async (type, id) => {
			console.log(`Deleting reminder: Type=${type}, ID=${id}`);
			const updatedReminders = { ...reminders };
			updatedReminders[type] = updatedReminders[type].filter((reminder) => reminder.id !== id);
			setReminders(updatedReminders);
			await writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Desktop });
		};

		const handleResetReminder = async (id) => {
			const updatedReminders = { ...reminders };
			const reminder = updatedReminders.repeated.find((reminder) => reminder.id === id);

			if (reminder) {
				console.log(`Reminder found:`, reminder);

				const now = new Date();
				const currentHour = now.getHours();
				const currentMinute = now.getMinutes();
				const currentSecond = 0;
				reminder.checked = false;

				switch (reminder.repeatFrequency) {
					case "hourly":
						reminder.repeatTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
						break;
					case "daily":
						reminder.repeatTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
						reminder.date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
						break;
					case "weekly":
						reminder.date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
						reminder.repeatTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
						now.setDate(now.getDate() + 7);
						break;
					case "monthly":
						reminder.date = `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
						reminder.repeatTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
						break;
					case "yearly":
						reminder.date = `${now.getFullYear() + 1}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
						reminder.repeatTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
						break;
					default:
						break;
				}

				const nextOccurrence = getNextOccurrence(reminder);

				setRepeatedCountdowns((prevCountdowns) => {
					const updatedCountdowns = {
						...prevCountdowns,
						[reminder.id]: formatCountdown(nextOccurrence - now),
					};
					return updatedCountdowns;
				});

				setReminders(updatedReminders);
				await writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Desktop });
			} else {
				console.warn(`Reminder with ID=${id} not found.`);
			}
		};

		const handleRenameReminder = (id, newName) => {
			const updatedReminders = { ...reminders };
			const reminder = updatedReminders.repeated.find((reminder) => reminder.id === id);
			if (reminder) {
				reminder.name = newName;
				setReminders(updatedReminders);
				writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Desktop });
			} else {
				const oneTimeReminder = updatedReminders.oneTime.find((reminder) => reminder.id === id);
				if (oneTimeReminder) {
					oneTimeReminder.name = newName;
					setReminders(updatedReminders);
					writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Desktop });
				}
			}
		};

		const handleToggleCheckbox = async (id) => {
			const updatedReminders = { ...reminders };
			const reminder = updatedReminders.repeated.find((r) => r.id === id);

			if (reminder) {
				reminder.checked = !reminder.checked;
				setReminders(updatedReminders);
				await writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Desktop });
			}
		};

		switch (activeTab) {
			case "one-time":
				return (
					<div className="tab-content">
						<h2>One-Time Reminders</h2>
						{reminders.oneTime.map((reminder) => (
							<div key={reminder.id} className="reminder-item">
								<span>
									{reminder.name} - {formatDateTime(reminder.date, reminder.time)} - {oneTimeCountdowns[reminder.id] || "Calculating..."}
								</span>
								<button onClick={() => handleDeleteReminder("oneTime", reminder.id)}>Delete</button>
								<button
									onClick={() => {
										const newName = prompt("Enter new name:", reminder.name);
										if (newName && newName.trim() !== "") {
											handleRenameReminder(reminder.id, newName);
										}
									}}
								>
									Rename
								</button>
							</div>
						))}
					</div>
				);
			case "repeated":
				return (
					<div className="tab-content">
						<h2>Repeated Reminders</h2>
						{reminders.repeated.map((reminder) => (
							<div key={reminder.id} className="reminder-item">
								<span>
									{reminder.name} - {formatDateTime("", reminder.repeatTime)} - {repeatedCountdowns[reminder.id] || "Calculating..."}
								</span>
								<label>
									<input type="checkbox" checked={reminder.checked} onChange={() => handleToggleCheckbox(reminder.id)} />
									Active
								</label>
								<button onClick={() => handleDeleteReminder("repeated", reminder.id)}>Delete</button>
								<button onClick={() => handleResetReminder(reminder.id)}>Reset</button>
								<button
									onClick={() => {
										const newName = prompt("Enter new name:", reminder.name);
										if (newName && newName.trim() !== "") {
											handleRenameReminder(reminder.id, newName);
										}
									}}
								>
									Rename
								</button>
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
				<h1>SushiReminder</h1>
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

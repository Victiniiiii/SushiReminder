import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { v4 as uuidv4 } from "uuid";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { readTextFile, writeTextFile, BaseDirectory, exists } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TrayIcon } from "@tauri-apps/api/tray";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { app } from "@tauri-apps/api";
import { Header, Navbar, Settings, Titlebar } from "./elements.js";
import { options } from "./systemTray.js";
import { useHotkeys } from "./hotkeys.js";
import "./index.css";

const App = () => {
	const { focusHideHotkeyFunction, quitHotkeyFunction } = useHotkeys();
	const [sortBy, setSortBy] = useState(() => localStorage.getItem("sortBy") || "custom");
	const [isDarkMode, setIsDarkMode] = useState(() => JSON.parse(localStorage.getItem("isDarkMode")) || true);
	const [activeTab, setActiveTab] = useState("one-time");
	const [reminderType, setReminderType] = useState("one-time");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [trayExists, setTrayExists] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingReminder, setEditingReminder] = useState(null);
	const [countdowns, setCountdowns] = useState({});
	const [oneTimeCountdowns, setOneTimeCountdowns] = useState({});
	const [repeatedCountdowns, setRepeatedCountdowns] = useState({});
	const [reminders, setReminders] = useState({ oneTime: [], repeated: [] });
	const [reminderData, setReminderData] = useState({
		name: "",
		date: new Date().toLocaleDateString("en-CA"),
		time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		repeatFrequency: "hourly",
		resetMode: "manual",
		customInterval: "",
	});
	const appWindow = getCurrentWindow();

	useEffect(() => {
		document.getElementById("minimizeButton")?.addEventListener("click", () => appWindow.minimize());
		document.getElementById("hideButton")?.addEventListener("click", () => appWindow.hide());
		document.getElementById("closeButton")?.addEventListener("click", async () => appWindow.destroy());

		const loadReminders = async () => {
			if (!trayExists) {
				setTrayExists(true);
				await TrayIcon.new(options);
			}

			if (!(await isPermissionGranted(BaseDirectory.Document))) {
				if (!(await requestPermission(BaseDirectory.Document))) {
					alert("Notification permission denied.");
				}
			}

			try {
				if (await exists("reminders.json", { baseDir: BaseDirectory.Document })) {
					setReminders(JSON.parse(await readTextFile("reminders.json", { baseDir: BaseDirectory.Document })));
				} else {
					const initialData = JSON.stringify({ oneTime: [], repeated: [] });
					await writeTextFile("reminders.json", initialData, { baseDir: BaseDirectory.Document });
					setReminders(JSON.parse(initialData));
				}
			} catch (e) {
				console.error(e);
			}
		};

		loadReminders();
	}, []);

	useEffect(() => {
		const settings = { sortBy, isDarkMode };
		for (const key in settings) {
			localStorage.setItem(key, key === "isDarkMode" ? JSON.stringify(settings[key]) : settings[key]);
		}
	}, [sortBy, isDarkMode]);

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
						sendNotification(`One Time Reminder: ${reminder.name}`);
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

				if (timeDiff <= 1000) {
					if (!reminder.notified) {
						reminder.notified = true;
						sendNotification(`Repeated Reminder: ${reminder.name}`);
					}

					if (reminder.resetMode === "automatic") {
						reminder.date = now.toLocaleDateString("en-CA");
						reminder.checked = false;
						reminder.notified = false;

						if (reminder.repeatFrequency === "hourly") {
							const interval = parseInt(reminder.customInterval) || 1;
							const currentHour = now.getHours();
							const currentMinute = now.getMinutes();
							const newTime = new Date();
							newTime.setHours(currentHour, currentMinute, 0, 0);
							newTime.setHours(newTime.getHours() + interval);
							reminder.time = `${String(newTime.getHours()).padStart(2, "0")}:${String(newTime.getMinutes()).padStart(2, "0")}`;
						} else if (reminder.repeatFrequency === "daily") {
							const interval = parseInt(reminder.customInterval) || 1;
							const reminderDate = new Date();
							reminderDate.setDate(reminderDate.getDate() + interval);
							reminder.date = reminderDate.toLocaleDateString("en-CA");
						} else if (reminder.repeatFrequency === "weekly") {
							let daysOfWeek = [];
							for (let i = 0; i < 7; i++) if (reminder[`day-${i}`]) daysOfWeek.push(i);

							if (daysOfWeek.length > 0) {
								const currentDay = now.getDay();
								let nextDay = daysOfWeek.find((day) => day > currentDay);
								if (nextDay === undefined) nextDay = daysOfWeek[0];

								const daysToAdd = nextDay > currentDay ? nextDay - currentDay : 7 - currentDay + nextDay;

								const newDate = new Date();
								newDate.setDate(newDate.getDate() + daysToAdd);
								reminder.date = newDate.toLocaleDateString("en-CA");
							} else {
								const newDate = new Date();
								newDate.setDate(newDate.getDate() + 7);
								reminder.date = newDate.toLocaleDateString("en-CA");
							}
						} else if (reminder.repeatFrequency === "monthly") {
							const currentDate = new Date();
							currentDate.setMonth(currentDate.getMonth() + 1);
							reminder.date = currentDate.toLocaleDateString("en-CA");
						} else if (reminder.repeatFrequency === "yearly") {
							const currentDate = new Date();
							currentDate.setFullYear(currentDate.getFullYear() + 1);
							reminder.date = currentDate.toLocaleDateString("en-CA");
						}

						const newNextOccurrence = getNextOccurrence(reminder);
						newRepeatedCountdowns[reminder.id] = formatCountdown(newNextOccurrence - now);
					} else {
						newRepeatedCountdowns[reminder.id] = "Time's up!";
					}
				} else {
					newRepeatedCountdowns[reminder.id] = formatCountdown(timeDiff);
				}
			});

			setRepeatedCountdowns(newRepeatedCountdowns);
			setReminders(updatedReminders);

			writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Document });
		}, 1000);

		return () => clearInterval(interval);
	}, [reminders, oneTimeCountdowns, repeatedCountdowns]);

	const handleOpenCreateModal = () => {
		const now = new Date();
		const localDateString = now.toLocaleDateString("en-CA");
		const localHours = String(now.getHours()).padStart(2, "0");
		const localMinutes = String(now.getMinutes()).padStart(2, "0");
		const localTimeString = `${localHours}:${localMinutes}`;

		setReminderData({
			name: "",
			date: localDateString,
			time: localTimeString,
			repeatFrequency: "hourly",
			resetMode: "manual",
			customInterval: "",
		});

		activeTab === "repeated" ? setReminderType("repeated") : setReminderType("one-time");
		setIsModalOpen(true);
	};

	const getReminderStatusCounts = (reminderList, countdowns) => {
		let lessThanHour = 0;
		let expired = 0;

		reminderList.forEach((reminder) => {
			const countdown = countdowns[reminder.id];
			if (countdown === "Time's up!") {
				expired++;
			} else if (countdown?.startsWith("0h")) {
				lessThanHour++;
			}
		});

		return { lessThanHour, expired };
	};

	const oneTimeCounts = getReminderStatusCounts(reminders.oneTime, oneTimeCountdowns);
	const repeatedCounts = getReminderStatusCounts(reminders.repeated, repeatedCountdowns);

	const getNextOccurrence = (reminder) => {
		const now = new Date();
		let nextOccurrence = new Date();

		if (reminder.date) {
			const [year, month, day] = reminder.date.split("-").map((num) => parseInt(num, 10));
			nextOccurrence.setFullYear(year);
			nextOccurrence.setMonth(month - 1);
			nextOccurrence.setDate(day);
		} else {
			const year = now.getFullYear();
			const month = now.getMonth();
			const day = now.getDate();
			nextOccurrence.setFullYear(year);
			nextOccurrence.setMonth(month);
			nextOccurrence.setDate(day);

			reminder.date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		}

		if (reminder.time) {
			const [hours, minutes] = reminder.time.split(":").map((num) => parseInt(num, 10));
			nextOccurrence.setHours(hours);
			nextOccurrence.setMinutes(minutes);
			nextOccurrence.setSeconds(0);
			nextOccurrence.setMilliseconds(0);
		}

		if (reminder.resetMode === "manual" && reminder.notified) {
			return nextOccurrence;
		}

		if (nextOccurrence <= now) {
			if (reminder.repeatFrequency === "minute") {
				const interval = parseInt(reminder.customInterval) || 1;
				const minutesSinceMissed = Math.ceil((now - nextOccurrence) / (1000 * 60));
				const minutesToAdd = Math.ceil(minutesSinceMissed / interval) * interval;
				nextOccurrence.setMinutes(nextOccurrence.getMinutes() + minutesToAdd);
			} else if (reminder.repeatFrequency === "hourly") {
				const interval = parseInt(reminder.customInterval) || 1;
				const hoursSinceMissed = Math.ceil((now - nextOccurrence) / (1000 * 60 * 60));
				const hoursToAdd = Math.ceil(hoursSinceMissed / interval) * interval;
				nextOccurrence.setHours(nextOccurrence.getHours() + hoursToAdd);
			} else if (reminder.repeatFrequency === "daily") {
				const interval = parseInt(reminder.customInterval) || 1;
				const daysSinceMissed = Math.ceil((now - nextOccurrence) / (1000 * 60 * 60 * 24));
				const daysToAdd = Math.ceil(daysSinceMissed / interval) * interval;
				nextOccurrence.setDate(nextOccurrence.getDate() + daysToAdd);
			} else if (reminder.repeatFrequency === "weekly") {
				let daysOfWeek = [];
				for (let i = 0; i < 7; i++) {
					if (reminder[`day-${i}`]) daysOfWeek.push(i);
				}

				if (daysOfWeek.length === 0) {
					daysOfWeek.push(now.getDay());
				}

				if (reminder.resetMode === "automatic" || !reminder.notified) {
					while (!daysOfWeek.includes(nextOccurrence.getDay()) || nextOccurrence <= now) {
						nextOccurrence.setDate(nextOccurrence.getDate() + 1);
					}
				}
			} else if (reminder.repeatFrequency === "monthly") {
				if (reminder.resetMode === "automatic" || !reminder.notified) {
					let monthsToAdd = 1;
					let tempDate = new Date(nextOccurrence);
					while (tempDate <= now) {
						tempDate.setMonth(tempDate.getMonth() + 1);
						monthsToAdd++;
					}
					nextOccurrence.setMonth(nextOccurrence.getMonth() + monthsToAdd - 1);
				}
			} else if (reminder.repeatFrequency === "yearly") {
				if (reminder.resetMode === "automatic" || !reminder.notified) {
					let yearsToAdd = 1;
					let tempDate = new Date(nextOccurrence);
					while (tempDate <= now) {
						tempDate.setFullYear(tempDate.getFullYear() + 1);
						yearsToAdd++;
					}
					nextOccurrence.setFullYear(nextOccurrence.getFullYear() + yearsToAdd - 1);
				}
			}
		}

		return nextOccurrence;
	};

	const handleCreateReminder = async () => {
		if (reminderData.name === "") {
			alert("Please give a name to this reminder.");
			return;
		}

		const now = new Date();

		if (reminderType === "one-time") {
			const selectedDateTime = new Date(`${reminderData.date}T${reminderData.time}`);
			if (isNaN(selectedDateTime.getTime())) {
				alert("Error: The provided date and time are invalid.");
				return;
			} else if (selectedDateTime < now) {
				alert("Error: You cannot set a reminder in the past.");
				return;
			}
		} else if (reminderType === "repeated") {
			const customInterval = parseInt(reminderData.customInterval, 10) || 0;
			const repeatTimeParts = reminderData.time.split(":");
			const repeatHours = parseInt(repeatTimeParts[0], 10) || 0;
			const repeatMinutes = parseInt(repeatTimeParts[1], 10) || 0;

			let selectedDateTime = new Date();
			selectedDateTime.setHours(repeatHours, repeatMinutes, 0, 0);

			while (selectedDateTime < now) {
				if (reminderData.repeatFrequency === "minute") {
					selectedDateTime.setMinutes(selectedDateTime.getMinutes() + (customInterval || 1));
				} else if (reminderData.repeatFrequency === "hourly") {
					selectedDateTime.setHours(selectedDateTime.getHours() + (customInterval || 1));
				} else if (reminderData.repeatFrequency === "daily") {
					selectedDateTime.setDate(selectedDateTime.getDate() + (customInterval || 1));
				} else if (reminderData.repeatFrequency === "weekly") {
					const daysUntilNext = 7 - selectedDateTime.getDay() + (reminderData.dayOfWeek || 0);
					selectedDateTime.setDate(selectedDateTime.getDate() + (customInterval ? customInterval * 7 : daysUntilNext));
				} else if (reminderData.repeatFrequency === "monthly") {
					selectedDateTime.setMonth(selectedDateTime.getMonth() + (customInterval || 1));
				} else if (reminderData.repeatFrequency === "yearly") {
					selectedDateTime.setFullYear(selectedDateTime.getFullYear() + (customInterval || 1));
				}
			}

			if (isNaN(selectedDateTime.getTime())) {
				alert("Error: The provided time or custom interval is invalid.");
				return;
			}
		}

		const updatedReminders = { ...reminders };

		if (reminderData.id) {
			if (reminderType === "one-time") {
				updatedReminders.oneTime = updatedReminders.oneTime.map((reminder) => (reminder.id === reminderData.id ? { ...reminder, ...reminderData } : reminder));
			} else {
				updatedReminders.repeated = updatedReminders.repeated.map((reminder) => (reminder.id === reminderData.id ? { ...reminder, ...reminderData } : reminder));
			}
		} else {
			const newReminder = { ...reminderData, id: uuidv4(), notified: false };
			if (reminderType === "one-time") {
				updatedReminders.oneTime.push(newReminder);
			} else {
				updatedReminders.repeated.push(newReminder);
			}
			console.log("newReminder :>> ", newReminder);
		}

		setReminders(updatedReminders);
		await writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Document });

		setIsModalOpen(false);
		setReminderData({
			name: "",
			date: new Date().toLocaleDateString("en-CA"),
			time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
			repeatFrequency: "hourly",
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
		timeDiff = Math.max(0, timeDiff);

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

	const onDragEnd = (result) => {
		if (!result.destination) return;

		const { source, destination } = result;
		const updatedReminders = { ...reminders };

		const reminderType = activeTab === "one-time" ? "oneTime" : activeTab;

		if (!updatedReminders[reminderType]) {
			console.error(`Reminder type "${reminderType}" not found in reminders object`);
			return;
		}

		const movedReminder = updatedReminders[reminderType][source.index];

		updatedReminders[reminderType].splice(source.index, 1);
		updatedReminders[reminderType].splice(destination.index, 0, movedReminder);

		setReminders(updatedReminders);
	};

	const renderModalContent = () => {
		const currentDate = new Date().toLocaleDateString("en-CA");
		const currentTime = new Intl.DateTimeFormat("en-CA", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		}).format(new Date());

		const initialData = { ...reminderData };

		return (
			<div className={`${isDarkMode ? "dark" : "light"} fixed inset-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center`}>
				<div className={`modal-content ${isDarkMode ? "bg-gray-800 text-white dark-scrollbar" : "bg-white text-black"} p-4 rounded-lg w-[90%] max-w-sm text-left max-h-[97vh] overflow-y-auto flex items-stretch flex-col`}>
					<label className="block mb-4">
						Reminder Name:
						<input type="text" name="name" value={initialData.name} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
					</label>
					<label className="block mb-4">
						Reminder Type:
						<select value={reminderType} onChange={(e) => setReminderType(e.target.value)} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`}>
							<option value="one-time">One-Time</option>
							<option value="repeated">Repeated</option>
						</select>
					</label>
					{reminderType === "one-time" && (
						<>
							<label className="block mb-4">
								Date:
								<input type="date" name="date" value={initialData.date} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
							</label>
							<div className="flex gap-4 mb-4 flex-row">
								<div className="w-full sm:w-1/2">
									<label className="block">
										Time:
										<input type="time" name="time" value={initialData.time} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"} w-full`} />
									</label>
								</div>
								<div className="w-full sm:w-1/2 flex flex-col justify-center">
									<span className="mb-1">Quick set minutes:</span>
									<div className="flex flex-wrap gap-2">
										{[0, 15, 30, 45].map((minute) => (
											<button
												key={minute}
												type="button"
												onClick={() => {
													const currentTime = reminderData.time || "";
													const [hours] = currentTime.split(":");
													const newTime = `${hours || "00"}:${String(minute).padStart(2, "0")}`;
													setReminderData((prev) => ({ ...prev, time: newTime }));
												}}
												className={`w-8 px-2 py-1 rounded text-sm text-center ${isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"}`}
											>
												{minute}
											</button>
										))}
									</div>
								</div>
							</div>
						</>
					)}
					{reminderType === "repeated" && (
						<>
							<label className="block mb-4">
								Frequency:
								<select name="repeatFrequency" value={initialData.repeatFrequency} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`}>
									<option value="minute">Minute</option>
									<option value="hourly">Hourly</option>
									<option value="daily">Daily</option>
									<option value="weekly">Weekly</option>
									<option value="monthly">Monthly</option>
									<option value="yearly">Yearly</option>
								</select>
							</label>
							{initialData.repeatFrequency === "minute" || initialData.repeatFrequency === "hourly" || initialData.repeatFrequency === "daily" ? (
								<>
									<div className="flex gap-4 mb-4 flex-row">
										<div className="w-full sm:w-1/2">
											<label className="block">
												Time:
												<input type="time" name="time" value={initialData.time} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"} w-full`} />
											</label>
										</div>
										<div className="w-full sm:w-1/2 flex flex-col justify-center">
											<span className="mb-1">Quick set minutes:</span>
											<div className="flex flex-wrap gap-2">
												{[0, 15, 30, 45].map((minute) => (
													<button
														key={minute}
														type="button"
														onClick={() => {
															const currentTime = reminderData.time || "";
															const [hours] = currentTime.split(":");
															const newTime = `${hours || "00"}:${String(minute).padStart(2, "0")}`;
															setReminderData((prev) => ({ ...prev, time: newTime }));
														}}
														className={`w-8 px-2 py-1 rounded text-sm text-center ${isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"}`}
													>
														{minute}
													</button>
												))}
											</div>
										</div>
									</div>

									<label className="block mb-4">
										Custom Interval (in {initialData.repeatFrequency === "minute" ? "minutes" : initialData.repeatFrequency === "hourly" ? "hours" : "days"}):
										<input type="number" name="customInterval" value={initialData.customInterval || 1} onChange={handleInputChange} min="1" className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
								</>
							) : null}
							{initialData.repeatFrequency === "weekly" && (
								<>
									<label>Which days to repeat:</label>
									<div>
										{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => (
											<label key={index} className="block">
												<input type="checkbox" name={`day-${index}`} checked={initialData[`day-${index}`] || false} onChange={handleInputChange} />
												{day}
											</label>
										))}
									</div>
									<label>
										Time:
										<input type="time" name="time" value={initialData.time} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
								</>
							)}
							{initialData.repeatFrequency === "monthly" && (
								<>
									<label>
										Select Date:
										<input type="date" name="date" value={initialData.date} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
									<label>
										Time:
										<input type="time" name="time" value={initialData.time} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
								</>
							)}
							{initialData.repeatFrequency === "yearly" && (
								<>
									<label>
										Yearly Reminder Date:
										<input type="date" name="date" value={initialData.date} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
									<label>
										Time:
										<input type="time" name="time" value={initialData.time} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
								</>
							)}
							<label className="block mb-4">
								Reset Mode:
								<select name="resetMode" value={initialData.resetMode} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`}>
									<option value="manual">Manual</option>
									<option value="automatic">Automatic</option>
								</select>
							</label>
						</>
					)}
					<div className="flex gap-4 mt-4 justify-end modal-actions">
						<button onClick={handleCreateReminder} className={`${isDarkMode ? "bg-gray-600 text-white" : "bg-blue-500 text-black"}`}>
							Save
						</button>
						<button onClick={() => setIsModalOpen(false)} className={`text-black ${isDarkMode ? "bg-gray-600" : "bg-red-500"}`}>
							Cancel
						</button>
					</div>
				</div>
			</div>
		);
	};

	const renderTabContent = () => {
		const now = new Date();

		const handleDeleteReminder = async (type, id) => {
			const updatedReminders = { ...reminders };
			updatedReminders[type] = updatedReminders[type].filter((reminder) => reminder.id !== id);
			setReminders(updatedReminders);
			await writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Document });
		};

		const handleResetReminder = async (id) => {
			const updatedReminders = { ...reminders };
			const reminder = updatedReminders.repeated.find((reminder) => reminder.id === id);

			if (!reminder) {
				console.warn(`Reminder with ID=${id} not found.`);
				return;
			}

			const now = new Date();

			const hours = now.getHours();
			const minutes = now.getMinutes();
			const formattedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

			const year = now.getFullYear();
			const month = now.getMonth() + 1;
			const day = now.getDate();
			const formattedDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

			reminder.checked = false;
			reminder.notified = false;
			reminder.time = formattedTime;

			const interval = parseInt(reminder.customInterval) || 1;

			if (reminder.repeatFrequency === "minute") {
				const nextDate = new Date(now);
				nextDate.setMinutes(nextDate.getMinutes() + interval);

				reminder.time = `${String(nextDate.getHours()).padStart(2, "0")}:${String(nextDate.getMinutes()).padStart(2, "0")}`;
			} else if (reminder.repeatFrequency === "hourly") {
				const nextDate = new Date(now);
				nextDate.setHours(nextDate.getHours() + interval);

				reminder.time = `${String(nextDate.getHours()).padStart(2, "0")}:${String(nextDate.getMinutes()).padStart(2, "0")}`;
			} else if (reminder.repeatFrequency === "daily") {
				const nextDate = new Date(now);
				nextDate.setDate(nextDate.getDate() + interval);

				reminder.date = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
			} else if (reminder.repeatFrequency === "weekly") {
				let daysOfWeek = [];
				for (let i = 0; i < 7; i++) {
					if (reminder[`day-${i}`]) daysOfWeek.push(i);
				}

				let nextDate = new Date(now);
				const currentDay = now.getDay();

				if (daysOfWeek.length > 0) {
					let nextDay = daysOfWeek.find((day) => day > currentDay);
					if (nextDay === undefined) nextDay = daysOfWeek[0];

					const daysToAdd = nextDay > currentDay ? nextDay - currentDay : 7 - currentDay + nextDay;
					nextDate.setDate(now.getDate() + daysToAdd);
				} else {
					nextDate.setDate(now.getDate() + 7);
				}

				reminder.date = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
			} else if (reminder.repeatFrequency === "monthly") {
				const nextDate = new Date(now);
				nextDate.setMonth(now.getMonth() + 1);

				const dayOfMonth = parseInt(reminder.date.split("-")[2]);
				const lastDayOfNextMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();

				nextDate.setDate(Math.min(dayOfMonth, lastDayOfNextMonth));

				reminder.date = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
			} else if (reminder.repeatFrequency === "yearly") {
				const [year, month, day] = reminder.date.split("-").map(Number);
				const nextDate = new Date();
				nextDate.setFullYear(nextDate.getFullYear() + 1);
				nextDate.setMonth(month - 1);

				if (month === 2 && day === 29) {
					const isLeapYear = (nextDate.getFullYear() % 4 === 0 && nextDate.getFullYear() % 100 !== 0) || nextDate.getFullYear() % 400 === 0;
					nextDate.setDate(isLeapYear ? 29 : 28);
				} else {
					nextDate.setDate(day);
				}

				reminder.date = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
			}

			const nextOccurrence = getNextOccurrence(reminder);
			const timeDiff = nextOccurrence - now;

			setRepeatedCountdowns((prevCountdowns) => ({
				...prevCountdowns,
				[reminder.id]: formatCountdown(timeDiff),
			}));

			setReminders(updatedReminders);
			await writeTextFile("reminders.json", JSON.stringify(updatedReminders), {
				baseDir: BaseDirectory.Document,
			});
		};

		const handleToggleCheckbox = async (id) => {
			const updatedReminders = { ...reminders };
			const reminder = updatedReminders.repeated.find((r) => r.id === id);

			if (reminder) {
				reminder.checked = !reminder.checked;
				setReminders(updatedReminders);
				await writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Document });
			}
		};

		const parseTimeRemaining = (countdown) => {
			if (typeof countdown !== "string") return Infinity;
			const timeParts = countdown.match(/(\d+)\s*(\w+)/);
			if (!timeParts) return Infinity;

			const [_, value, unit] = timeParts;
			const unitToSeconds = {
				second: 1,
				seconds: 1,
				minute: 60,
				minutes: 60,
				hour: 3600,
				hours: 3600,
				day: 86400,
				days: 86400,
			};

			return parseInt(value, 10) * (unitToSeconds[unit.toLowerCase()] || Infinity);
		};

		const renderReminders = (type) => {
			const sortReminders = (reminders) => {
				const sortedReminders = reminders.slice();

				sortedReminders.sort((a, b) => {
					if (a.checked && !b.checked) return 1;
					if (!a.checked && b.checked) return -1;

					if (sortBy === "time") {
						const getTimeRemaining = (reminder) => {
							const countdown = type === "oneTime" ? oneTimeCountdowns[reminder.id] : repeatedCountdowns[reminder.id] || "Calculating...";

							if (countdown === "Time's up!") return -Infinity;
							if (countdown === "Calculating...") return Infinity;

							const nextOccurrence = getNextOccurrence(reminder);
							const now = new Date();
							const timeDiffSeconds = Math.max((nextOccurrence - now) / 1000, 0);

							return timeDiffSeconds;
						};

						const timeA = getTimeRemaining(a);
						const timeB = getTimeRemaining(b);
						return timeA - timeB;
					} else if (sortBy === "name") {
						return a.name.localeCompare(b.name);
					}
					return 0;
				});

				return sortedReminders;
			};

			return (
				<Droppable droppableId={type}>
					{(provided) => (
						<div {...provided.droppableProps} ref={provided.innerRef} className={`custom-height p-4 overflow-y-auto ${isDarkMode ? "dark-scrollbar" : ""}`}>
							{sortReminders(reminders[type]).map((reminder, index) => (
								<Draggable key={reminder.id} draggableId={reminder.id} index={index}>
									{(provided) => (
										<div {...provided.draggableProps} {...provided.dragHandleProps} ref={provided.innerRef} className="reminder-item justify-between">
											<div className="leftSide">
												<span
													className={reminder.checked ? "!line-through !text-gray-500" : ""}
													style={{
														color: (type === "oneTime" && oneTimeCountdowns[reminder.id] === "Time's up!") || (type === "repeated" && repeatedCountdowns[reminder.id] === "Time's up!") ? "red" : (type === "oneTime" && oneTimeCountdowns[reminder.id]?.startsWith("0h")) || (type === "repeated" && repeatedCountdowns[reminder.id]?.startsWith("0h")) ? "#ff6666" : "inherit",
													}}
												>
													{reminder.name} -{" "}
													{type === "oneTime"
														? formatDateTime(reminder.date, reminder.time)
														: (() => {
																const nextOccurrence = getNextOccurrence(reminder);
																const hours = String(nextOccurrence.getHours()).padStart(2, "0");
																const minutes = String(nextOccurrence.getMinutes()).padStart(2, "0");

																const today = new Date();
																if (nextOccurrence.toDateString() === today.toDateString()) {
																	return `Today at ${hours}:${minutes}`;
																} else if (nextOccurrence.getDate() === today.getDate() + 1 && nextOccurrence.getMonth() === today.getMonth() && nextOccurrence.getFullYear() === today.getFullYear()) {
																	return `Tomorrow at ${hours}:${minutes}`;
																} else {
																	return formatDateTime(nextOccurrence.toLocaleDateString("en-CA"), `${hours}:${minutes}`);
																}
														  })()}{" "}
													- {type === "oneTime" ? oneTimeCountdowns[reminder.id] : repeatedCountdowns[reminder.id] || "Calculating..."}{" "}
												</span>
											</div>
											<div className="rightSide gap-2 flex">
												{type === "repeated" && (
													<label>
														<input type="checkbox" checked={reminder.checked} onChange={() => handleToggleCheckbox(reminder.id)} />
														Active
													</label>
												)}
												<button onClick={() => handleDeleteReminder(type, reminder.id)}>Delete</button>
												{type === "repeated" && <button onClick={() => handleResetReminder(reminder.id)}>Reset</button>}
												<button
													onClick={() => {
														setIsModalOpen(true);
														setReminderData(reminder);
														setReminderType(type === "oneTime" ? "one-time" : "repeated");
													}}
												>
													Edit
												</button>
											</div>
										</div>
									)}
								</Draggable>
							))}
							{provided.placeholder}

							{isModalOpen && renderModalContent()}
						</div>
					)}
				</Droppable>
			);
		};

		switch (activeTab) {
			case "one-time":
				return <DragDropContext onDragEnd={onDragEnd}>{renderReminders("oneTime")}</DragDropContext>;
			case "repeated":
				return <DragDropContext onDragEnd={onDragEnd}>{renderReminders("repeated")}</DragDropContext>;
			case "settings":
				return <Settings sortBy={sortBy} setSortBy={setSortBy} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} focusHideHotkeyFunction={focusHideHotkeyFunction} quitHotkeyFunction={quitHotkeyFunction} />;
			default:
				return null;
		}
	};

	return (
		<div
			className={`${isDarkMode ? "dark" : "light"} w-full h-full min-w-[100dvw] min-h-[100dvh] ${isDarkMode ? "text-white" : "text-black"} overflow-hidden`}
			style={{
				background: isDarkMode
					? "radial-gradient(at 24% 32%, #111111 0px, transparent 50%), radial-gradient(at 80% 28%, #010710 0px, transparent 50%), radial-gradient(at 12% 93%, #0d0400 0px, transparent 50%), radial-gradient(at 59% 74%, #1b1221 0px, transparent 50%), #000000"
					: "radial-gradient(at 24% 32%, #9fb5b5 0px, transparent 50%), radial-gradient(at 80% 28%, #9bc0f9 0px, transparent 50%), radial-gradient(at 12% 93%, #ffceb9 0px, transparent 50%), radial-gradient(at 59% 74%, #c8b4d6 0px, transparent 50%), #ffffff",
			}}
		>
			<Titlebar isDarkMode={isDarkMode} />
			<main className="h-full">
				<Header setIsModalOpen={handleOpenCreateModal} isDarkMode={isDarkMode} />
				<Navbar activeTab={activeTab} setActiveTab={setActiveTab} isDarkMode={isDarkMode} oneTimeCounts={oneTimeCounts} repeatedCounts={repeatedCounts} />
				<div>{renderTabContent()}</div>
			</main>
			{isModalOpen && renderModalContent()}
		</div>
	);
};

export default App;

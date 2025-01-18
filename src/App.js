import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { v4 as uuidv4 } from "uuid";
import { readTextFile, writeTextFile, BaseDirectory, exists } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TrayIcon } from "@tauri-apps/api/tray";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { app } from "@tauri-apps/api";
import { Header, Navbar, Settings, Titlebar } from "./elements.js";
import { options } from "./systemTray.js";
import { ensurePermission } from "./permissions.js";
import "./index.css";

const App = () => {
	const [focusHideHotkey, setFocusHideHotkey] = useState(() => {
		const storedHotkey = localStorage.getItem("focusHideHotkey");
		if (!storedHotkey) {
			localStorage.setItem("focusHideHotkey", "R");
			return "R";
		}
		return storedHotkey;
	});
	const [quitHotkey, setQuitHotkey] = useState(() => {
		const storedQuitHotkey = localStorage.getItem("quitHotkey");
		if (!storedQuitHotkey) {
			localStorage.setItem("quitHotkey", "T");
			return "T";
		}
		return storedQuitHotkey;
	});
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
		date: new Date().toISOString().split("T")[0],
		time: new Date().toTimeString().slice(0, 5),
		repeatFrequency: "hourly",
		resetMode: "manual",
		customInterval: "",
	});
	const appWindow = getCurrentWindow();

	useEffect(() => {
		document.getElementById("minimizeButton")?.addEventListener("click", () => appWindow.minimize());
		document.getElementById("hideButton")?.addEventListener("click", () => appWindow.hide());
		document.getElementById("closeButton")?.addEventListener("click", () => appWindow.destroy());

		const registerHotkeys = async () => {
			register(`Shift+Alt+${quitHotkey}`, (event) => {
				if (event.state === "Pressed") {
					appWindow.destroy();
				}
			});
			register(`Shift+Alt+${focusHideHotkey}`, async (event) => {
				if (event.state === "Pressed") {
					const isWindowMinimized = await appWindow.isMinimized();
					const isWindowVisible = await appWindow.isVisible();
					if (isWindowMinimized || !isWindowVisible) {
						appWindow.unminimize();
						appWindow.show();
						appWindow.setFocus();
					} else {
						appWindow.minimize();
					}
				}
			});
		};

		const loadReminders = async () => {
			if (!trayExists) {
				await TrayIcon.new(options);
				setTrayExists(true);
			}
			await ensurePermission();
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
		registerHotkeys();
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
					const handleReminderRestart = async (reminder, now) => {
						if (!reminder.notified) {
							reminder.notified = true;
							sendNotification(`Repeated Reminder: ${reminder.name}`);
						}

						reminder.date = now.toISOString().split("T")[0];

						if (reminder.resetMode === "automatic") {
							const newNextOccurrence = getNextOccurrence(reminder, true);
							newRepeatedCountdowns[reminder.id] = formatCountdown(newNextOccurrence - now);
							reminder.checked = false;
							reminder.notified = false;
						} else {
							newRepeatedCountdowns[reminder.id] = "Time's up!";
						}
					};
					handleReminderRestart(reminder, now);
				} else if (!(newRepeatedCountdowns[reminder.id] == "Time's up!")) {
					newRepeatedCountdowns[reminder.id] = formatCountdown(timeDiff);
				}
			});

			setRepeatedCountdowns(newRepeatedCountdowns);
			setReminders(updatedReminders);

			writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Document });
		}, 1000);

		return () => clearInterval(interval);
	}, [reminders, oneTimeCountdowns, repeatedCountdowns]);

	const focusHideHotkeyFunction = () => {
		const input = prompt("Enter the hotkey for focusing and hiding app. Will be use with Shift + Alt.", focusHideHotkey);
		if (input) setFocusHideHotkey(input);
		unregister(`Shift+Alt+${focusHideHotkey}`);
		register(`Shift+Alt+${input}`, async (event) => {
			if (event.state === "Pressed") {
				const isWindowMinimized = await appWindow.isMinimized();
				const isWindowVisible = await appWindow.isVisible();
				if (isWindowMinimized || !isWindowVisible) {
					appWindow.unminimize();
					appWindow.show();
					appWindow.setFocus();
				} else {
					appWindow.minimize();
				}
			}
		});
		localStorage.setItem("focusHideHotkey", input);
	};

	const quitHotkeyFunction = () => {
		const input = prompt("Enter the hotkey for quitting app. Will be use with Shift + Alt.", quitHotkey);
		if (input) setQuitHotkey(input);
		unregister(`Shift+Alt+${quitHotkey}`);
		register(`Shift+Alt+${input}`, (event) => {
			if (event.state === "Pressed") {
				appWindow.destroy();
			}
		});
		localStorage.setItem("quitHotkey", input);
	};

	const getNextOccurrence = (reminder) => {
		const now = new Date();
		let nextOccurrence = new Date();

		if (reminder.date) {
			const lastDateParts = reminder.date.split("-");
			nextOccurrence.setFullYear(parseInt(lastDateParts[0]), parseInt(lastDateParts[1]) - 1, parseInt(lastDateParts[2]));
		} else {
			reminder.date = now.toISOString().split("T")[0];
		}

		const reminderTime = reminder.time.split(":");
		const reminderHour = parseInt(reminderTime[0]);
		const reminderMinute = parseInt(reminderTime[1]);
		nextOccurrence.setHours(reminderHour, reminderMinute, 0, 0);

		if (reminder.repeatFrequency === "hourly") {
			nextOccurrence.setHours(nextOccurrence.getHours() + (reminder.customInterval ? parseInt(reminder.customInterval) : 1));
		} else if (reminder.repeatFrequency === "daily") {
			nextOccurrence.setDate(nextOccurrence.getDate() + (reminder.customInterval ? parseInt(reminder.customInterval) : 1));
		} else if (reminder.repeatFrequency === "weekly") {
			let daysToAdd = 0;
			const daysOfWeek = [];
			for (let i = 0; i < 7; i++) if (reminder[`day-${i}`]) daysOfWeek.push(i);
			while (!daysOfWeek.includes(nextOccurrence.getDay()) || nextOccurrence <= now) {
				nextOccurrence.setDate(nextOccurrence.getDate() + 1);
			}
		} else if (reminder.repeatFrequency === "monthly") {
			nextOccurrence.setMonth(nextOccurrence.getMonth() + 1);
		} else if (reminder.repeatFrequency === "yearly") {
			nextOccurrence.setFullYear(nextOccurrence.getFullYear() + 1);
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
				selectedDateTime.setMinutes(selectedDateTime.getMinutes() + customInterval);
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
		}

		setReminders(updatedReminders);
		await writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Document });

		setIsModalOpen(false);
		setReminderData({
			name: "",
			date: "",
			time: "",
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
		const movedReminder = updatedReminders[activeTab][source.index];

		updatedReminders[activeTab].splice(source.index, 1);
		updatedReminders[activeTab].splice(destination.index, 0, movedReminder);

		setReminders(updatedReminders);
	};

	const renderModalContent = () => {
		const currentDate = new Date().toISOString().split("T")[0];
		const currentTime = new Intl.DateTimeFormat("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
			timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		}).format(new Date());

		return (
			<div className={`${isDarkMode ? "dark" : "light"} fixed inset-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center`}>
				<div className={`modal-content ${isDarkMode ? "bg-gray-800 text-white" : "bg-white text-black"} p-8 rounded-lg w-[90%] max-w-sm text-left max-h-[80vh] overflow-y-scroll flex items-stretch flex-col`}>
					<label className="block mb-4">
						Reminder Name:
						<input type="text" name="name" value={reminderData.name} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
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
							<label>
								Date:
								<input type="date" name="date" value={reminderData.date || currentDate} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
							</label>
							<label>
								Time:
								<input type="time" name="time" value={reminderData.time || currentTime} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
							</label>
						</>
					)}
					{reminderType === "repeated" && (
						<>
							<label>
								Frequency:
								<select name="repeatFrequency" value={reminderData.repeatFrequency} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`}>
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
										<input type="time" name="time" value={reminderData.time || currentTime} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
									<label>
										Custom Interval (in hours/days):
										<input type="number" name="customInterval" value={reminderData.customInterval || 1} onChange={handleInputChange} min="1" className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
								</>
							) : null}
							{reminderData.repeatFrequency === "weekly" && (
								<>
									<label>Which days to repeat:</label>
									<div>
										{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => (
											<label key={index} className="block">
												<input type="checkbox" name={`day-${index}`} checked={reminderData[`day-${index}`] || false} onChange={handleInputChange} />
												{day}
											</label>
										))}
									</div>
									<label>
										Time:
										<input type="time" name="time" value={reminderData.time || currentTime} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
								</>
							)}
							{reminderData.repeatFrequency === "monthly" && (
								<>
									<label>
										Select Date:
										<input type="date" name="repeatDate" value={reminderData.repeatDate || currentDate} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
									<label>
										Time:
										<input type="time" name="time" value={reminderData.time || currentTime} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
								</>
							)}
							{reminderData.repeatFrequency === "yearly" && (
								<>
									<label>
										Yearly Reminder Date:
										<input type="date" name="repeatDate" value={reminderData.repeatDate || currentDate} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
									<label>
										Time:
										<input type="time" name="time" value={reminderData.time || currentTime} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`} />
									</label>
								</>
							)}
							<label>
								Reset Mode:
								<select name="resetMode" value={reminderData.resetMode} onChange={handleInputChange} className={`${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`}>
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
						<button onClick={() => setIsModalOpen(false)} className={`${isDarkMode ? "bg-gray-600 text-white" : "bg-red-500 text-black"}`}>
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

			if (reminder) {
				const now = new Date();
				const localDate = new Date(now.toLocaleString("en-US", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));

				const currentHour = localDate.getHours();
				const currentMinute = localDate.getMinutes();
				const currentSecond = 0;
				reminder.checked = false;

				const formatDate = (date) => {
					return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
				};

				switch (reminder.repeatFrequency) {
					case "hourly":
						reminder.time = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
						break;
					case "daily":
						reminder.time = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
						reminder.date = formatDate(localDate);
						break;
					case "weekly":
						localDate.setDate(localDate.getDate() + 7);
						reminder.date = formatDate(localDate);
						reminder.time = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
						break;
					case "monthly":
						localDate.setMonth(localDate.getMonth() + 1);
						reminder.date = formatDate(localDate);
						reminder.time = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
						break;
					case "yearly":
						localDate.setFullYear(localDate.getFullYear() + 1);
						reminder.date = formatDate(localDate);
						reminder.time = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
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
				await writeTextFile("reminders.json", JSON.stringify(updatedReminders), { baseDir: BaseDirectory.Document });
			} else {
				console.warn(`Reminder with ID=${id} not found.`);
			}
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

				if (sortBy === "time") {
					sortedReminders.sort((a, b) => {
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
					});
				} else if (sortBy === "name") {
					sortedReminders.sort((a, b) => a.name.localeCompare(b.name));
				}
				return sortedReminders;
			};

			return (
				<Droppable droppableId={type}>
					{(provided) => (
						<div {...provided.droppableProps} ref={provided.innerRef} className="tab-content">
							{sortReminders(reminders[type]).map((reminder, index) => (
								<Draggable key={reminder.id} draggableId={reminder.id} index={index}>
									{(provided) => (
										<div {...provided.draggableProps} {...provided.dragHandleProps} ref={provided.innerRef} className="reminder-item justify-between">
											<div className="leftSide">
												<span className={reminder.checked ? "line-through" : ""}>
													{reminder.name} - {type === "oneTime" ? formatDateTime(reminder.date, reminder.time) : formatDateTime("", reminder.time)} - {type === "oneTime" ? oneTimeCountdowns[reminder.id] : repeatedCountdowns[reminder.id] || "Calculating..."}
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
			className={`${isDarkMode ? "dark" : "light"} w-[100dvw] h-[100dvh] ${isDarkMode ? "text-white" : "text-black"}`}
			style={{
				background: isDarkMode
					? "radial-gradient(at 24% 32%, #111111 0px, transparent 50%), radial-gradient(at 80% 28%, #010710 0px, transparent 50%), radial-gradient(at 12% 93%, #0d0400 0px, transparent 50%), radial-gradient(at 59% 74%, #1b1221 0px, transparent 50%), #000000"
					: "radial-gradient(at 24% 32%, #9fb5b5 0px, transparent 50%), radial-gradient(at 80% 28%, #9bc0f9 0px, transparent 50%), radial-gradient(at 12% 93%, #ffceb9 0px, transparent 50%), radial-gradient(at 59% 74%, #c8b4d6 0px, transparent 50%), #ffffff",
			}}
		>
			<Titlebar isDarkMode={isDarkMode} />
			<main>
				<Header setIsModalOpen={setIsModalOpen} isDarkMode={isDarkMode} />
				<Navbar activeTab={activeTab} setActiveTab={setActiveTab} isDarkMode={isDarkMode} />
				{renderTabContent()}
			</main>
			{isModalOpen && renderModalContent()}
		</div>
	);
};

export default App;

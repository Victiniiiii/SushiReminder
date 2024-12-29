import React, { useState, useEffect } from "react";
import "./App.css";
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

const App = () => {
    const [activeTab, setActiveTab] = useState("one-time");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [reminderType, setReminderType] = useState("one-time");
    const [reminderData, setReminderData] = useState({
        name: "",
        date: "",
        time: "",
        repeatFrequency: "hourly",
        repeatTime: "",
    });
    const [reminders, setReminders] = useState({ oneTime: [], repeated: [] });

    useEffect(() => {
        const loadReminders = async () => {
            try {
                const data = await readTextFile("reminders.json", { dir: BaseDirectory.App });
                setReminders(JSON.parse(data));
            } catch (error) {
                console.log("No existing reminders found, starting fresh.");
                setReminders({ oneTime: [], repeated: [] });
            }
        };
        loadReminders();
    }, []);

    const saveReminders = async (updatedReminders) => {
        setReminders(updatedReminders);
        await writeTextFile(
            { path: "reminders.json", contents: JSON.stringify(updatedReminders) },
            { dir: BaseDirectory.App }
        );
    };

    const handleCreateReminder = async () => {
        const newReminder = { ...reminderData };
        const updatedReminders = { ...reminders };

        if (reminderType === "one-time") {
            updatedReminders.oneTime.push(newReminder);
        } else {
            updatedReminders.repeated.push(newReminder);
        }

        await saveReminders(updatedReminders);
        setIsModalOpen(false);
        resetReminderForm();
    };

    const resetReminderForm = () => {
        setReminderData({
            name: "",
            date: "",
            time: "",
            repeatFrequency: "hourly",
            repeatTime: "",
        });
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
                        <input
                            type="text"
                            name="name"
                            value={reminderData.name}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Reminder Type:
                        <select
                            value={reminderType}
                            onChange={(e) => setReminderType(e.target.value)}
                        >
                            <option value="one-time">One-Time</option>
                            <option value="repeated">Repeated</option>
                        </select>
                    </label>
                    {reminderType === "one-time" && (
                        <>
                            <label>
                                Date:
                                <input
                                    type="date"
                                    name="date"
                                    value={reminderData.date}
                                    onChange={handleInputChange}
                                />
                            </label>
                            <label>
                                Time:
                                <input
                                    type="time"
                                    name="time"
                                    value={reminderData.time}
                                    onChange={handleInputChange}
                                />
                            </label>
                        </>
                    )}
                    {reminderType === "repeated" && (
                        <>
                            <label>
                                Frequency:
                                <select
                                    name="repeatFrequency"
                                    value={reminderData.repeatFrequency}
                                    onChange={handleInputChange}
                                >
                                    <option value="hourly">Hourly</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="yearly">Yearly</option>
                                </select>
                            </label>
                            <label>
                                Time:
                                <input
                                    type="time"
                                    name="repeatTime"
                                    value={reminderData.repeatTime}
                                    onChange={handleInputChange}
                                />
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
                                    {reminder.name} - {reminder.date} {reminder.time}
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
                                    {reminder.name} - {reminder.repeatFrequency} at{" "}
                                    {reminder.repeatTime}
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
                <button
                    className={activeTab === "one-time" ? "active" : ""}
                    onClick={() => setActiveTab("one-time")}
                >
                    One-Time Reminders
                </button>
                <button
                    className={activeTab === "repeated" ? "active" : ""}
                    onClick={() => setActiveTab("repeated")}
                >
                    Repeated Reminders
                </button>
                <button
                    className={activeTab === "settings" ? "active" : ""}
                    onClick={() => setActiveTab("settings")}
                >
                    Settings
                </button>
            </nav>
            <main>{renderTabContent()}</main>
            {isModalOpen && renderModalContent()}
        </div>
    );
};

export default App;

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { useHotkeys } from "./hotkeys.js";
import "./index.css";

export const Titlebar = ({ isDarkMode }) => (
	<div data-tauri-drag-region className={`h-8 select-none flex justify-end bg-gray-900 text-white`} id="titlebar">
		<div id="minimizeButton" className="text-xl font-bold cursor-pointer w-8 h-8 text-center leading-8">
			&minus;
		</div>
		<div id="hideButton" className="ml-2 mt-1.5 cursor-pointer">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" strokeWidth="2">
				<path d="M15 12h3.586a1 1 0 0 1 .707 1.707l-6.586 6.586a1 1 0 0 1 -1.414 0l-6.586 -6.586a1 1 0 0 1 .707 -1.707h3.586v-3h6v3z"></path>
				<path d="M15 3h-6"></path>
				<path d="M15 6h-6"></path>
			</svg>
		</div>
		<div id="closeButton" className="text-xl font-bold cursor-pointer w-8 h-8 text-center leading-8 ml-1">
			&times;
		</div>
	</div>
);

export const Header = ({ setIsModalOpen, isDarkMode }) => (
	<header className={`text-center flex justify-center items-center h-20 ${isDarkMode ? "bg-[#1c0738]" : "bg-[#6200ea]"} text-white`}>
		<h1 className="text-[33px] w-80">SushiReminder</h1>
		<button
			className={`absolute right-3 text-[15px] h-auto border-white border-2 cursor-pointer py-2 px-2 rounded-xl ${isDarkMode ? "bg-blue-800" : "bg-blue-900"}`}
			onClick={() => {
				setIsModalOpen(true);
			}}
		>
			Create Reminder
		</button>
	</header>
);

const Ball = ({ count, color, offsetX = 0 }) =>
	count > 0 && (
		<span
			className="ml-1 inline-flex items-center justify-center text-xs font-bold text-white rounded-full"
			style={{
				position: "absolute",
				transform: `translate(${offsetX}px, -10px)`,
				backgroundColor: color,
				minWidth: "18px",
				height: "18px",
				padding: "0 5px",
			}}
		>
			{count}
		</span>
	);

export const Navbar = ({ activeTab, setActiveTab, isDarkMode, oneTimeCounts, repeatedCounts }) => (
	<nav className={`flex justify-center py-2`}>
		<button className={`mx-4 py-2 px-4 border-b-2 cursor-pointer text-base ${activeTab === "one-time" ? "text-[#6200ea] border-[#6200ea]" : "border-transparent"}`} onClick={() => setActiveTab("one-time")}>
			One-Time Reminders
			<Ball count={oneTimeCounts.expired} color="red" offsetX={0} />
			<Ball count={oneTimeCounts.lessThanHour} color="#ff6666" offsetX={20} />
		</button>

		<button className={`mx-4 py-2 px-4 border-b-2 cursor-pointer text-base ${activeTab === "repeated" ? "text-[#6200ea] border-[#6200ea]" : "border-transparent"}`} onClick={() => setActiveTab("repeated")}>
			Repeated Reminders
			<Ball count={repeatedCounts.expired} color="red" offsetX={0} />
			<Ball count={repeatedCounts.lessThanHour} color="#ff6666" offsetX={20} />
		</button>

		<button className={`mx-4 py-2 px-4 border-b-2 cursor-pointer text-base ${activeTab === "settings" ? "text-[#6200ea] border-[#6200ea]" : "border-transparent"}`} onClick={() => setActiveTab("settings")}>
			Settings
		</button>
	</nav>
);

export const Settings = ({ sortBy, setSortBy, isDarkMode, setIsDarkMode, focusHideHotkeyFunction, playAudio, quitHotkeyFunction, selectedAudio, setSelectedAudio }) => {
	const audioOptions = [
		{ value: "none", label: "No Audio" },
		{ value: "a", label: "Boom" },
		{ value: "b", label: "Nokia Saul" },
		{ value: "c", label: "Boop" },
	];
	return (
		<div className={`space-y-6 flex flex-col items-center`}>
			<div className="flex items-center space-x-4">
				<span>Sort by:</span>
				<span className={`${sortBy === "name" ? "text-green-500" : "text-gray-500"}`}>Name</span>
				<span className={`${sortBy === "time" ? "text-green-500" : "text-gray-500"}`}>Time</span>
				<span className={`${sortBy === "custom" ? "text-green-500" : "text-gray-500"}`}>Custom</span>
				<div className={`relative inline-block w-16 h-6 ${isDarkMode ? "bg-gray-600" : "bg-gray-300"} rounded-full cursor-pointer`} onClick={() => setSortBy(sortBy === "name" ? "time" : sortBy === "time" ? "custom" : "name")}>
					<div className={`absolute top-1 left-1 w-4 h-4 ${isDarkMode ? "bg-gray-900" : "bg-white"} rounded-full transition-transform duration-200 ${sortBy === "time" ? "transform translate-x-5" : sortBy === "custom" ? "transform translate-x-10" : ""}`}></div>
				</div>
			</div>
			<div className="flex items-center space-x-4">
				<span>UI Theme:</span>
				<span className={`${!isDarkMode ? "text-green-500" : "text-gray-500"}`}>Light</span>
				<span className={`${isDarkMode ? "text-green-500" : "text-gray-500"}`}>Dark</span>
				<div className={`relative inline-block w-12 h-6 ${isDarkMode ? "bg-gray-600" : "bg-gray-300"} rounded-full cursor-pointer`} onClick={() => setIsDarkMode(!isDarkMode)}>
					<div className={`absolute top-1 left-1 w-4 h-4 ${isDarkMode ? "bg-gray-900" : "bg-white"} rounded-full transition-transform duration-200 ${isDarkMode ? "transform translate-x-6" : ""}`}></div>
				</div>
			</div>
			<div className="mb-4 flex items-center justify-between">
				<span>Notification Sound:</span>
				<div className="relative w-32 flex items-center justify-center text-center mx-2">
					<select value={selectedAudio} onChange={(e) => setSelectedAudio(e.target.value)} className={`block appearance-none w-full py-2 rounded-xl ${isDarkMode ? "bg-gray-700 text-white" : "bg-gray-200 text-black"}`}>
						{audioOptions.map((option) => (
							<option className="flex items-center justify-center text-center" key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>
				<button className="bg-green-700 px-4 py-2 rounded-xl text-gray-200" onClick={playAudio}>
					Test the Notification Sound
				</button>
			</div>
			<button className="bg-green-700 px-4 py-2 rounded-xl text-gray-200" onClick={focusHideHotkeyFunction}>
				Set Hotkey for Focusing and Hiding App
			</button>
			<button className="bg-green-700 px-4 py-2 rounded-xl text-gray-200" onClick={quitHotkeyFunction}>
				Set Hotkey for Quitting App
			</button>
		</div>
	);
};

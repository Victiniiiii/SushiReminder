import "./index.css";
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

export const Titlebar = ({ isDarkMode }) => (
	<div data-tauri-drag-region className={`h-8 select-none flex justify-end bg-gray-900 text-white`} id="titlebar">
		<div id="minimizeButton" className="text-xl font-bold cursor-pointer w-8 h-8 text-center leading-8">
			&minus;
		</div>
		<div id="hideButton" className="ml-2 mt-1.5">
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
		<button className={`absolute right-3 text-[15px] h-auto border-white border-2 cursor-pointer py-2 px-2 rounded-xl ${isDarkMode ? "bg-blue-800" : "bg-blue-900"}`} onClick={() => setIsModalOpen(true)}>
			Create Reminder
		</button>
	</header>
);

export const Navbar = ({ activeTab, setActiveTab, isDarkMode }) => (
	<nav className={`flex justify-center py-2`}>
		<button className={`mx-4 py-2 px-4 border-b-2 cursor-pointer text-base ${activeTab === "one-time" ? "text-[#6200ea] border-[#6200ea]" : "border-transparent"}`} onClick={() => setActiveTab("one-time")}>
			One-Time Reminders
		</button>
		<button className={`mx-4 py-2 px-4 border-b-2 cursor-pointer text-base ${activeTab === "repeated" ? "text-[#6200ea] border-[#6200ea]" : "border-transparent"}`} onClick={() => setActiveTab("repeated")}>
			Repeated Reminders
		</button>
		<button className={`mx-4 py-2 px-4 border-b-2 cursor-pointer text-base ${activeTab === "settings" ? "text-[#6200ea] border-[#6200ea]" : "border-transparent"}`} onClick={() => setActiveTab("settings")}>
			Settings
		</button>
	</nav>
);

export const Settings = ({ sortBy, setSortBy, isDarkMode, setIsDarkMode }) => (
	<div className={`tab-content space-y-6`}>
		<div className="flex items-center space-x-4">
			<span>Sort by:</span>
			<span className={`${sortBy === "name" ? "text-green-500" : "text-gray-500"}`}>Name</span>
			<div className={`relative inline-block w-12 h-6 ${isDarkMode ? "bg-gray-600" : "bg-gray-300"} rounded-full cursor-pointer`} onClick={() => setSortBy(sortBy === "time" ? "name" : "time")}>
				<div className={`absolute top-1 left-1 w-4 h-4 ${isDarkMode ? "bg-gray-900" : "bg-white"} rounded-full transition-transform duration-200 ${sortBy === "time" ? "transform translate-x-6" : ""}`}></div>
			</div>
			<span className={`${sortBy === "time" ? "text-green-500" : "text-gray-500"}`}>Time</span>
		</div>

		<div className="flex items-center space-x-4">
			<span>UI Theme:</span>
			<span className={`${isDarkMode ? "text-green-500" : "text-gray-500"}`}>Light</span>
			<div className={`relative inline-block w-12 h-6 ${isDarkMode ? "bg-gray-600" : "bg-gray-300"} rounded-full cursor-pointer`} onClick={() => setIsDarkMode(!isDarkMode)}>
				<div className={`absolute top-1 left-1 w-4 h-4 ${isDarkMode ? "bg-gray-900" : "bg-white"} rounded-full transition-transform duration-200 ${isDarkMode ? "transform translate-x-6" : ""}`}></div>
			</div>
			<span className={`${!isDarkMode ? "text-green-500" : "text-gray-500"}`}>Dark</span>
		</div>
	</div>
);

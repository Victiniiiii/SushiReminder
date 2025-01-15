import "./index.css";
import React, { useState } from "react";
import ReactDOM from "react-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

export const Header = ({ setIsModalOpen }) => (
	<header className="header items-center bg-[#6200ea] text-white flex justify-center text-center h-20">
		<h1 className="text-[33px] w-80">SushiReminder</h1>
		<button className="create-button absolute right-3 text-[15px] h-auto bg-blue-900 border-white border-2 cursor-pointer py-2 px-2 rounded-xl" onClick={() => setIsModalOpen(true)}>
			Create Reminder
		</button>
	</header>
);

export const Navbar = ({ activeTab, setActiveTab }) => (
	<nav className="tabs bg-[#bfd2e25e] flex justify-center py-2">
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
);

export const Settings = ({ sortBy, setSortBy }) => (
	<div className="tab-content">
		<button onClick={() => setSortBy(sortBy === "time" ? "name" : "time")}>Sort by: {sortBy === "time" ? "Name" : "Time"}</button>
	</div>
);

export const Titlebar = () => (
	<div data-tauri-drag-region className="titlebar" id="titlebar">
		<div id="minimizeButton">&minus;</div>
		<div id="hideButton">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" stroke-width="2">
				<path d="M15 12h3.586a1 1 0 0 1 .707 1.707l-6.586 6.586a1 1 0 0 1 -1.414 0l-6.586 -6.586a1 1 0 0 1 .707 -1.707h3.586v-3h6v3z"></path>
				<path d="M15 3h-6"></path>
				<path d="M15 6h-6"></path>
			</svg>
		</div>
		<div id="closeButton">&times;</div>
	</div>
);

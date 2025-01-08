import "./index.css";

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

export const Settings = () => (
	<div className="tab-content">
		<h2>Settings</h2>
		<p>Configure your preferences here.</p>
	</div>
);

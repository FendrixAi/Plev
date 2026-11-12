# Jam Fokus Desktop

**A desktop productivity app designed to help you stay focused, organize your tasks, and understand how you spend your time.**

Jam Fokus is a Windows desktop productivity application built with Electron. It brings task management, focus sessions, scheduling, progress tracking, and journaling together in one workspace.

## ✨ Features

### 🏠 Home Dashboard
- View your daily productivity overview.
- See tasks planned for your current focus session.
- Access important activities from one central dashboard.

### 📋 Task Management
- Create, organize, and manage tasks.
- Structure work around goals and milestones.
- Track task priorities and progress.

### 📅 Calendar
- Organize tasks according to dates.
- Get a clearer overview of your schedule.

### ⏱️ Focus Timer
- Run dedicated focus sessions.
- Track actual time spent focusing.
- Continue working beyond the original timer target.
- Keep track of focus session duration.

### 📊 Analytics
- Review productivity and focus activity.
- Understand how your time is distributed.

### 📖 Focus History
- Review previous focus sessions.
- Keep a record of completed work.

### 📝 Daily Reports
- Review daily productivity and completed activities.

### 🎯 Goals
- Organize long-term objectives.
- Break goals down into milestones and actionable tasks.

### 📓 Journaling
- Record daily reflections and thoughts.
- Build a habit of reviewing your progress.

### 📚 Library
- Keep useful materials and resources organized in one place.

### 🎨 Multiple Experiences
Jam Fokus supports different visual experiences:
- **Original** — the original Jam Fokus interface.
- **Capybara World** — a cozy, capybara-inspired workspace experience.

The selected experience can be managed through the application's display settings.

## 🖥️ Screenshots

<!-- Add your application screenshots here -->

| Home | Tasks |
|---|---|
| Add screenshot here | Add screenshot here |

| Focus Timer | Analytics |
|---|---|
| Add screenshot here | Add screenshot here |

## 🛠️ Built With

- **Electron 45.3.0** — Desktop application framework.
- **Node.js** — JavaScript runtime.
- **JavaScript, HTML, and CSS** — Application interface and logic.
- **electron-builder 25.1.8** — Windows application packaging.

## 🚀 Getting Started

### Prerequisites

Make sure you have installed:
- [Node.js](https://nodejs.org/)
- npm

### Installation

Clone the repository:

```bash
git clone https://github.com/FendrixAi/Plev.git
```

Navigate to the project directory:

```bash
cd Plev
```

Install dependencies:

```bash
npm install
```

### Run Locally

Check the available scripts in `package.json` and run the appropriate development command.

### Build for Windows

To generate a Windows portable build:

```bash
npx electron-builder --win portable
```

The packaged application will be generated in the configured build output directory.

## 📁 Project Structure

```text
jam-fokus-desktop/
├── main.js
├── preload.js
├── renderer/
│   └── experiences/
│       └── capybara-world/
├── package.json
└── ...
```

*The structure above is a simplified overview. Refer to the repository for the complete source tree.*

## 🎯 Project Goals

Jam Fokus aims to make personal productivity easier by combining:

- Task organization
- Goal planning
- Focus time tracking
- Productivity insights
- Daily reflection

Rather than focusing only on time management, Jam Fokus provides a workspace for planning, doing, and reviewing your work.

## 📌 Project Status

Jam Fokus is under active development. Features, interface designs, and user experiences may evolve over time.

## 📄 License

No license has been specified yet.

If you plan to make this project open source, consider adding a license file to clarify how others may use, modify, and distribute the software.

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
- **Mola World** — a bright, illustrated world with its own focus flow.
- **Fast Food (day & night)** — a diner-themed workspace with two visual modes.

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

- **Electron 45.3.3** — Desktop application framework.
- **Node.js** — JavaScript runtime.
- **JavaScript, HTML, and CSS** — Application interface and logic.
- **electron-updater 6.8.11** — Update download and verification flow.
- **electron-builder 26.18.0** — Windows application packaging.

## 🚀 Getting Started

### Prerequisites

Make sure you have installed:
- [Node.js](https://nodejs.org/) (LTS recommended)
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

Start the application:

```bash
npm start
```

### Test

Run the full test suite:

```bash
npm test
```

### Build for Windows

Generate the portable build:

```bash
npm run build
```

Or generate the NSIS installer:

```bash
npm run build:installer
```

The packaged application is written to `dist/`.

### Release and Code Signing

Public releases must be code-signed. The release script refuses to publish without a certificate and a GitHub token:

```powershell
$env:WIN_CSC_LINK = "C:\path\to\certificate.pfx"
$env:WIN_CSC_KEY_PASSWORD = "<certificate-password>"
$env:GH_TOKEN = "<github-token>"
npm run release
```

Never commit certificates, passwords, or tokens. Local builds without a certificate are unsigned and must not be published. Downloaded updates stop at the **ready** state and are only installed after the user presses **Pasang sekarang**.

#### Unsigned test pre-release

For testing without a certificate, use the explicit test path:

```powershell
$env:JF_ALLOW_UNSIGNED_RELEASE = "1"
$env:GH_TOKEN = "<github-token>"
npm run release:test
```

This builds an unsigned NSIS installer and publishes it as a GitHub **pre-release**. Normal stable updaters ignore pre-releases. Never promote this build to a stable release or distribute it as production software. Use `npm run release` for a signed production release.

To build the unsigned installer without uploading:

```powershell
$env:JF_ALLOW_UNSIGNED_RELEASE = "1"
node scripts/release-test.js --dry-run
```

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

This project is **UNLICENSED** and proprietary. No permission is granted to use, copy, modify, or distribute it without explicit permission from the author.

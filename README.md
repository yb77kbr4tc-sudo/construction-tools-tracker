# Construction Tools Tracker

A production-ready starter for a construction company tool tracking system.

## Stack
- React frontend for phone/tablet-friendly UI
- Express API backend
- SQLite database for local persistence
- JWT-based authentication with manager/worker roles
- Invite codes for worker access

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Start the app:

```bash
npm run dev
```

This runs both the API server and the Vite frontend.

- Frontend: http://localhost:5173
- API: http://localhost:3001

## Features
- Add and track tools
- Check tools in and out by worker and site
- Search tools by name, serial, location, or category
- Manager dashboard with inventory overview
- Worker dashboard for personal tool checkouts
- Invite code system for worker access
- SQLite database persistence

## Folder structure

- `server/` – Express API and SQLite database logic
- `src/` – React frontend
- `index.html` – Vite entry
- `vite.config.js` – local dev proxy config

## Production notes
- Replace the default JWT secret in `.env`
- Add Docker/container deployment or a hosted database for multi-device production use
- Add HTTPS and secure admin access for real deployment

## Optional future upgrades
- Photos and damage reporting
- Maintenance scheduling
- Email/SMS invites
- CSV export and reporting
- Offline sync and push notifications

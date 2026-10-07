# Construction Tools Tracker

A mobile-friendly construction tools tracking app for phones and tablets.

## Features
- Add and manage tools
- Check tools in and out manually
- Assign tools to workers and sites
- Search inventory
- Manager and worker roles
- Invite-based worker access
- Local backend and SQLite persistence
- Capacitor wrapper for Android/iOS packaging

## Run locally

```bash
npm install
npm run dev
```

Then open the frontend at:

- http://localhost:5173

The API runs at:

- http://localhost:3001

## Native mobile setup

This app is ready to be wrapped as a native mobile app using Capacitor.

### Install native dependencies

```bash
npm install
npx cap add android
npx cap add ios
```

### Build and sync native app

```bash
npm run sync
```

Then open the generated Android Studio/Xcode project and run the app on device/emulator.

## Notes
- This is a production-style starter.
- For live business deployment, add secure hosting, proper auth, backups, and production infrastructure.

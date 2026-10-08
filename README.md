# Hubballi Crackers - React + Vite + Firebase

## Run (Windows)
    cd C:\repo
    .\setup.ps1          # installs, opens VS Code, starts http://localhost:5173

Or manually: `npm install`, `code .`, then in VS Code press **F5** ("Run in Edge") or run `npm run dev`.
When VS Code asks, choose **Allow** for automatic tasks so the dev server starts on folder open.

## Firebase
Copy `.env.example` to `.env`, fill the values, deploy `firestore.rules`, and load data with `seed.js`
(`npm i firebase-admin`, put `serviceAccount.json` here, `node seed.js`). Without `.env`, built-in sample rates are shown.
Edit `src/App.jsx` for SHOP_EMAIL and PHONES.

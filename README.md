# Hubballi Crackers - React + Vite + Firebase

## Run (Windows)
    cd C:\repo
    .\setup.ps1          # installs, opens VS Code, starts http://localhost:5173

Or manually: `npm install`, `code .`, then in VS Code press **F5** ("Run in Edge") or run `npm run dev`.
When VS Code asks, choose **Allow** for automatic tasks so the dev server starts on folder open.

## Firebase
Copy `.env.example` to `.env`, fill the values, deploy `firestore.rules`, and load data with
`npm run seed:firebase` (put a Firebase Admin service account at `serviceAccount.json`). Without
`.env`, built-in sample rates are shown. The seeder only writes to an empty catalog or one it
previously seeded; it refuses to mix sample entries with other product records.
Edit `src/App.jsx` for SHOP_EMAIL and PHONES.

## Enquiries and order lookup
Submitting an enquiry saves its customer details, item list, totals, and pending-confirmation status
to the Firestore `orders` collection. The generated document ID is shown to the customer and can
be entered in the **Find Order** section to retrieve that record. Share the ID only with the
customer: anyone who has it can retrieve the associated contact and delivery details. Deploy the
included `firestore.rules` before enabling order submissions; orders cannot be saved until Firebase
is configured and the rules are deployed.
New orders use a unique six-digit numeric ID, and **Find your order** opens a separate lookup page.
Because six-digit IDs are guessable, the public lookup rules are suitable only for low-risk enquiry
details; use authenticated/backend-mediated lookup before storing sensitive customer information.
After changing the rules, publish the latest `firestore.rules` in Firebase Console so new orders are
restricted to six-digit document IDs.

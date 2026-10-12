# Hubballi Crackers - React + Vite + Firebase

## Run (Windows)
    cd C:\repo
    .\setup.ps1          # installs, opens VS Code, starts http://localhost:5173

Or manually: `npm install`, `code .`, then in VS Code press **F5** ("Run in Edge") or run `npm run dev`.
When VS Code asks, choose **Allow** for automatic tasks so the dev server starts on folder open.

## Firebase
Copy `.env.example` to `.env` and fill in the Firebase web app values. Deploy `firestore.rules` so
the storefront can read the public catalog and save enquiries. To publish the full catalog in
`products.json`, authenticate with Google Cloud Application Default Credentials and run:

    gcloud auth application-default login
    npm run seed:firebase

Install the Google Cloud CLI first if `gcloud` is not recognized. The project ID is read from
`VITE_FIREBASE_PROJECT_ID` in `.env`; alternatively set `FIREBASE_PROJECT_ID` in the environment.
The authenticated Google account needs permission to write Firestore data in that Firebase
project. No service-account JSON or private key is needed.

Each product in `products.json` configures its name, unit, listed price, category, emoji, net-rate
flag, active flag, display order, and image URL. Set `imageUrl` to a path under `public/`, an
absolute HTTP(S) URL, or `null` when there is no image. The storefront fetches active products and
prices from Firestore when it loads and opens product images from their configured URLs. Set an
optional `offerPrice` to override the shop-wide discount for a special price.

The seeder validates the catalog and uses readable document IDs derived from product names, such as
`combo-pack-starter`. It replaces its managed catalog, migrates the old `sample-###` IDs, and
refuses to overwrite unrecognized product records. Inactive products remain in Firestore but are
hidden from the storefront. Ground Chakkars and Flower Pots are separate categories. Rainbow
Spinner Big and Rainbow Spinner Spl are inactive placeholders until their prices are configured:
enter verified prices and any image URLs in `products.json`, set `active` to `true`, then rerun
`npm run seed:firebase`. Without Firebase catalog data, the storefront displays its built-in sample
rates.

For GitHub Pages builds, add repository Actions variables named
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and
`VITE_FIREBASE_APP_ID` under **Settings → Secrets and variables → Actions → Variables**.
The deploy workflow injects them into Vite when building. These are Firebase web-app config
values and are included in the public site bundle; never put a service-account private key in
these variables or in any `VITE_` variable.
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

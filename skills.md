# Hubballi Crackers Project Skills

This file documents the project conventions for maintaining the Hubballi Crackers storefront and its protected admin tools.

## Stack and commands

- React 19 with Vite 7
- Firebase Authentication and Cloud Firestore
- Firebase Hosting and GitHub Pages deployments
- Node.js 22 in CI; Node.js 20.19 or newer is required by Vite

```bash
npm install
npm run dev
npm run build
npm run preview
npm run seed:firebase
```

The build workflow uses `npm install --force --include=optional` so Vite's optional native dependencies are installed in GitHub Actions.

## Firestore is the source of truth

- Product rates, product metadata, orders, inventory, and site analytics must come from Firestore.
- Do not use browser local storage for products, prices, carts, orders, or inventory.
- The app uses the project's default Firestore database.
- Deploy security rule changes with:

```bash
firebase deploy --only firestore:rules
```

## Collections and important fields

### `products`

Product documents include fields such as:

- `name`, `customerName`, `variant`, `category`, `unit`
- `price`, `offerPrice`, `imageUrl`
- `active`, `order`
- `itemsPerCase`, `stockQuantity`, `lowStockThreshold`

Inactive products must not appear in the customer catalog or be orderable. `customerName` is the customer-facing name. `variant` is an internal admin label and must not be shown as a separate customer product when variants share one customer-facing product.

Product images are uploaded to Firebase Storage under `product-images/`. The resulting download URL is saved in the product document's `imageUrl` field. Do not store large image binaries directly in Firestore.

### `orders`

Orders are saved in the `orders` collection. Order history, customer lookup, order management, and delivery status must read from this collection.

### `inventory`

Inventory records are stored per product and shop. The current shops are:

- Tadas Cross
- Shiggaon

Use `itemsPerCase` for case-to-piece calculations:

```text
Total Received = Received Cases * Items per Case + Received Pieces
Total Pending  = Pending Cases  * Items per Case + Pending Pieces
Sold           = Total Received - Total Pending
```

Pending values represent physical stock still at each shop. The inventory admin page must show each shop and an all-shops total.

### `siteAnalytics`

Anonymous interaction events are stored in `siteAnalytics`. Supported event names are:

- `view_product`
- `add_to_cart`
- `start_order`
- `submit_order`

The admin **Site Analytics** tab reads these records and shows event totals plus the most viewed products. Analytics failures must not block browsing or checkout.

## Admin access and security

- The admin page requires Google Authentication.
- Access is limited to the addresses in `ADMIN_EMAILS` in `src/firebase.js`.
- Firestore rules must allow public creation only for the approved analytics events and keep analytics reads admin-only.
- Keep order management, rate management, product management, stock management, inventory, and analytics inside the protected admin page.
- Never put Firebase service-account credentials in frontend code or repository files.

## Product and image management

- Admins can add products, rename products, edit categories, rates, images, variants, case quantities, and active status.
- Product images belong in `public/product-images/` when stored as local assets.
- Always provide an image fallback or placeholder.
- Social preview images belong in `public/` and must be referenced with absolute URLs in `index.html` for link previews.
- If an image URL is changed, update the Firestore product document as well as the local catalog or seed data when applicable.

## UI conventions

- Customer product cards should remain usable on small screens and must hide inactive products.
- Admin work areas are separated into tabs: overview, orders, stock, rates, inventory, and analytics.
- Keep order history and admin controls out of the normal customer shopping flow.
- Use clear loading, empty, and error states for Firebase reads and writes.
- Preserve the customer-facing distinction between a product and its internal variants.

## Caching and Firebase usage

- Customer product images should use normal browser caching. Product image URLs change when an image is replaced, so customers do not need a forced cache bypass.
- Firebase Hosting sets long-lived cache headers for hashed JS/CSS and a one-week cache for product images; `index.html` remains revalidated for deployments.
- Admin image previews should use cache busting so an administrator can immediately verify a replacement.
- Product-rate reads are deduplicated in memory and cached briefly for customers; Firestore remains the source of truth.
- Do not add repeated Firestore writes for quantity changes or repeated image opens unless the user action represents a new tracked event.

## Deployment

`.github/workflows/deploy.yml` builds the site, deploys GitHub Pages, and then deploys Firebase Hosting and Firestore rules. Storage rules are deployed after Firebase Storage is initialized in the Firebase Console. Required GitHub configuration includes:

- Repository variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
- Repository secret: `FIREBASE_TOKEN`

Run `npm run build` before pushing. A successful local build does not deploy Firestore rules; rules must be deployed separately or through the configured Firebase workflow.

## Useful files

- `src/App.jsx` - storefront, cart, checkout, order history, and admin UI
- `src/firebase.js` - Firebase initialization, authentication, Firestore reads/writes, and analytics helpers
- `firestore.rules` - Firestore authorization rules
- `storage.rules` - Firebase Storage image upload and read rules
- `products.json` - catalog source used by seeding tools
- `seed.js` - product catalog publishing script
- `firebase-applet-config.json` - Firebase app configuration
- `firebase.json` - Firebase Hosting configuration
- `index.html` - document metadata and social preview tags
- `src/styles.css` - storefront and admin styles
- `.github/workflows/deploy.yml` - CI build and deployment workflow


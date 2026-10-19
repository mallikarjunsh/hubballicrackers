# Hubballi Crackers Project Skills

This file documents the conventions needed to maintain the Hubballi Crackers storefront.

## Stack

- React 19 with Vite
- Firebase Authentication and Firestore
- Firebase Hosting and GitHub Pages deployment
- Node.js 22 recommended; Node.js 20.19+ is required by Vite

## Data rules

- Product rates must always be loaded from Firestore.
- Do not use local storage as a product, rate, order, or inventory database.
- Product documents are stored in the `products` collection using a normalized name-based ID.
- Product fields include `name`, `customerName`, `variant`, `category`, `unit`, `price`, `offerPrice`, `imageUrl`, `active`, `itemsPerCase`, `stockQuantity`, and `lowStockThreshold`.
- Inactive products must not appear in the customer catalog or be orderable.
- Orders are stored in the `orders` collection.
- Inventory records are stored in the `inventory` collection by product and shop.

## Product management

- Admins can add products, rename products, edit categories, rates, images, variants, and active status.
- `customerName` is the name shown to customers.
- `variant` is an internal admin label and should not be shown in the customer catalog.
- Use `itemsPerCase` for case-to-piece calculations. The default is `1`.

## Inventory calculations

For each shop and product:

```text
Total Received = Received Cases × Items per Case + Received Pieces
Total Pending = Pending Cases × Items per Case + Pending Pieces
Sold = Total Received − Total Pending
```

Current shops:

- Tadas Cross
- Shiggaon

## Admin access

- The admin page is protected by Google Authentication.
- Only emails listed in `ADMIN_EMAILS` in `src/firebase.js` may access it.
- Keep order management, rate management, stock management, and inventory management inside the protected admin page.

## Images

- Product images belong in `public/product-images/`.
- Storefront images should include a fallback or placeholder when unavailable.
- Social preview images belong in `public/` and must be referenced with absolute URLs in `index.html`.

## Deployment

```bash
npm install
npm run build
```

GitHub Actions uses Node.js 22. Firebase Hosting deployment requires the `FIREBASE_TOKEN` repository secret.

## Useful files

- `src/App.jsx` — storefront and admin UI
- `src/firebase.js` — Firebase access and Firestore operations
- `products.json` — source catalog used by seeding tools
- `seed.js` — product catalog publishing script
- `firebase.json` — Firebase Hosting configuration
- `.github/workflows/deploy.yml` — deployment workflow

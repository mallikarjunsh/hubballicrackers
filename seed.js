import { readFile } from "node:fs/promises";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(await readFile(new URL("./serviceAccount.json", import.meta.url), "utf8"));
const products = JSON.parse(await readFile(new URL("./products.json", import.meta.url), "utf8"));

if (!Array.isArray(products) || products.length === 0 || products.length > 999) {
  throw new Error("products.json must contain between 1 and 999 products.");
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const existing = await db.collection("products").get();
const unrelatedProducts = existing.docs.filter(product => !/^sample-\d{3}$/.test(product.id));

if (unrelatedProducts.length) {
  throw new Error(`Found ${unrelatedProducts.length} non-sample product records; refusing to mix sample data with the existing catalog.`);
}

const expectedIds = new Set(products.map((_, index) => `sample-${String(index + 1).padStart(3, "0")}`));
const batch = db.batch();

products.forEach((product, index) => {
  batch.set(db.collection("products").doc(`sample-${String(index + 1).padStart(3, "0")}`), product);
});

existing.docs
  .filter(product => !expectedIds.has(product.id))
  .forEach(product => batch.delete(product.ref));

batch.set(db.doc("settings/shop"), {
  discount: 0.2,
  minOrder: { Karnataka: 1000, Maharashtra: 3000, Goa: 3000 },
});

await batch.commit();
console.log(`Published ${products.length} sample products and shop settings to Firestore.`);

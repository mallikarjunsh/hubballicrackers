import { access, readFile } from "node:fs/promises";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("./.env", import.meta.url));
let hasEnvFile = true;
try {
  await access(envPath);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  hasEnvFile = false;
}
if (hasEnvFile) process.loadEnvFile(envPath);

const products = JSON.parse(await readFile(new URL("./products.json", import.meta.url), "utf8"));
const projectId = process.env.FIREBASE_PROJECT_ID
  || process.env.GOOGLE_CLOUD_PROJECT
  || process.env.VITE_FIREBASE_PROJECT_ID;
const productDocumentId = name => name
  .normalize("NFKD")
  .replace(/\p{M}/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

if (!Array.isArray(products) || products.length === 0 || products.length > 999) {
  throw new Error("products.json must contain between 1 and 999 products.");
}

if (!projectId) {
  throw new Error("Set VITE_FIREBASE_PROJECT_ID in .env or FIREBASE_PROJECT_ID in your environment.");
}

const names = new Set();
const documentIds = new Set();
products.forEach((product, index) => {
  if (!product || typeof product !== "object" || Array.isArray(product)) {
    throw new Error(`Product at index ${index} must be an object.`);
  }
  for (const field of ["name", "unit", "category", "emoji"]) {
    if (typeof product[field] !== "string" || !product[field].trim()) {
      throw new Error(`Product at index ${index} must have a non-empty ${field}.`);
    }
  }
  if (typeof product.price !== "number" || !Number.isFinite(product.price) || product.price < 0) {
    throw new Error(`Product "${product.name}" must have a non-negative numeric price.`);
  }
  if (Object.hasOwn(product, "offerPrice")
    && (typeof product.offerPrice !== "number"
      || !Number.isFinite(product.offerPrice)
      || product.offerPrice < 0
      || product.offerPrice > product.price)) {
    throw new Error(`Product "${product.name}" must have an offerPrice between zero and its listed price.`);
  }
  if (typeof product.net !== "boolean" || typeof product.active !== "boolean") {
    throw new Error(`Product "${product.name}" must set net and active to true or false.`);
  }
  if (!Object.hasOwn(product, "imageUrl")
    || (product.imageUrl !== null && typeof product.imageUrl !== "string")) {
    throw new Error(`Product "${product.name}" must set imageUrl to a URL string or null.`);
  }
  if (typeof product.imageUrl === "string") {
    let imageUrl;
    try {
      imageUrl = new URL(product.imageUrl, "https://catalog.invalid/");
    } catch {
      throw new Error(`Product "${product.name}" has an invalid imageUrl.`);
    }
    if (!["http:", "https:"].includes(imageUrl.protocol)) {
      throw new Error(`Product "${product.name}" imageUrl must use HTTP or HTTPS.`);
    }
  }
  if (!Number.isInteger(product.order) || product.order < 0) {
    throw new Error(`Product "${product.name}" must have a non-negative integer order.`);
  }
  if (names.has(product.name)) throw new Error(`Duplicate product name: "${product.name}".`);
  names.add(product.name);
  const documentId = productDocumentId(product.name);
  if (!documentId) throw new Error(`Product "${product.name}" does not produce a valid Firestore document ID.`);
  if (documentIds.has(documentId)) throw new Error(`Product name slug collision for "${product.name}" (ID "${documentId}").`);
  documentIds.add(documentId);
});

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const existing = await db.collection("products").get();
const expectedProducts = new Map(products.map(product => [productDocumentId(product.name), product]));
const legacyProductNames = new Map([
  ["12-cm-colour-sparklers", ["10 Cm Colour Sparklers", "12 Cm Colour Sparklers"]],
  ["12-cm-electric-sparklers", ["10 Cm Electric Sparklers", "12 Cm Electric Sparklers"]],
  ["butterfly-18-pcs", "Butterfly (18 Pcs)"],
  ["15-cm-green-sparklers", "15 Cm Green Sparklers"],
  ["30-cm-red-sparklers", "30 Cm Red Sparklers"],
  ["12-shots-crackling", "12 Shots Crackling"],
  ["30-shots-multicolour", "30 Shots Multicolour"],
  ["60-shots-multicolour", "60 Shots Multicolour"],
  ["120-shots-multicolour", "120 Shots Multicolour"],
  ["ground-chakkar-big-25-pcs", "Ground Chakkar Big (25 Pcs)"],
  ["rainbow-spinner-big", "Rainbow Spinner Big"],
  ["rainbow-spinner-spl", "Rainbow Spinner Spl"],
  ["1000-wala-short", "1000 Wala (Short)"],
  ["2000-wala-premium", "2000 Wala (Premium)"],
  ["5000-wala-premium", "5000 Wala (Premium)"],
  ["100-wala", "100 Wala"],
  ["rainbow-spinner-deluxe-sunshine", "Rainbow Spinner Deluxe"],
  ["chitputhi-small-rehboth", "Chitputhi - Small (Rehboth)"],
  ["chitputhi-big-rehboth", "Chitputhi - Big (Rehboth)"],
]);
const unrelatedProducts = existing.docs.filter(product => {
  const name = product.data().name;
  if (/^sample-\d{3}$/.test(product.id)) return false;
  if (expectedProducts.get(product.id)?.name === name) return false;
  const legacyNames = legacyProductNames.get(product.id);
  return !(Array.isArray(legacyNames) ? legacyNames.includes(name) : legacyNames === name);
});

if (unrelatedProducts.length) {
  throw new Error(`Found ${unrelatedProducts.length} non-sample product records (${unrelatedProducts.map(product => `${product.id}: ${product.data().name}`).join(", ")}); refusing to mix sample data with the existing catalog.`);
}

const expectedIds = new Set(expectedProducts.keys());
const writes = [
  ...products.map(product => ({
    type: "set",
    ref: db.collection("products").doc(productDocumentId(product.name)),
    data: {
      ...product,
      stockQuantity: Number.isFinite(product.stockQuantity) ? product.stockQuantity : 0,
      lowStockThreshold: Number.isFinite(product.lowStockThreshold) ? product.lowStockThreshold : 5,
    },
  })),
  ...existing.docs
    .filter(product => !expectedIds.has(product.id))
    .map(product => ({ type: "delete", ref: product.ref })),
  {
    type: "set",
    ref: db.doc("settings/shop"),
    data: {
      discount: 0.2,
      minOrder: { Karnataka: 1000, Maharashtra: 3000, Goa: 3000 },
    },
  },
];

for (let offset = 0; offset < writes.length; offset += 500) {
  const batch = db.batch();
  writes.slice(offset, offset + 500).forEach(write => {
    if (write.type === "delete") batch.delete(write.ref);
    else batch.set(write.ref, write.data);
  });
  await batch.commit();
}

console.log(`Published ${products.length} products with name-based document IDs and shop settings to Firestore project "${projectId}".`);

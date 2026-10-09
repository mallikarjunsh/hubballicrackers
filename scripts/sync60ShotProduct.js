import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = getApps().length ? getApp() : initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const products = db.collection("products");
const product = {
  name: "60 Shots Multicolour",
  unit: "1 Box",
  price: 4800,
  category: "Multicolour Night Shots",
  emoji: "🎆",
  net: false,
  active: true,
  order: 30
};

const matches = await products.where("name", "==", product.name).limit(2).get();
if (matches.size > 1) throw new Error(`Multiple Firestore records found for ${product.name}.`);

const productRef = matches.empty ? products.doc("60-shots-multicolour") : matches.docs[0].ref;
await productRef.set(product, { merge: true });

const largerShotMatches = await products.where("name", "==", "120 Shots Multicolour").limit(2).get();
if (largerShotMatches.size > 1) throw new Error("Multiple Firestore records found for 120 Shots Multicolour.");
if (!largerShotMatches.empty) {
  await largerShotMatches.docs[0].ref.set({ order: 31 }, { merge: true });
}

console.log(`${matches.empty ? "Added" : "Updated"} ${product.name} in Firestore.`);

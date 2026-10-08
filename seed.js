// Usage: npm i firebase-admin && node seed.js   (needs serviceAccount.json from Firebase console > Project settings > Service accounts)
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./serviceAccount.json")) });
const db = admin.firestore();
(async () => {
  const batch = db.batch();
  require("./products.json").forEach(p => batch.set(db.collection("products").doc(), p));
  batch.set(db.doc("settings/shop"), { discount: 0.2, minOrder: { Karnataka: 1000, Maharashtra: 3000, Goa: 3000 } });
  await batch.commit();
  console.log("Seeded");
})();

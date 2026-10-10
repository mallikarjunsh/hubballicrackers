import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function database() {
  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  return getFirestore(getApps().length ? getApp() : initializeApp(cfg));
}

// Returns { cats, discount, minOrder } or null (no Firebase config / no products yet).
export async function loadRates() {
  if (!cfg.projectId) return null;
  const db = database();
  const [ps, st] = await Promise.all([getDocs(collection(db, "products")), getDoc(doc(db, "settings", "shop"))]);
  const rows = ps.docs.map(d => d.data()).filter(p => p.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!rows.length) return null;
  const cats = [];
  rows.forEach(p => {
    let c = cats.find(x => x.name === p.category);
    if (!c) { c = { id: "c" + cats.length, name: p.category, emoji: p.emoji || "🎆", net: !!p.net, items: [] }; cats.push(c); }
    c.items.push([p.name, p.unit || "1 Box", Number(p.price) || 0]);
  });
  const s = st.exists() ? st.data() : {};
  return { cats, discount: s.discount, minOrder: s.minOrder };
}

export async function saveOrder(order) {
  const db = database();
  const record = {
    ...order,
    status: "pending_confirmation",
    createdAt: serverTimestamp(),
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = String(Math.floor(Math.random() * 900000) + 100000);
    const orderRef = doc(db, "orders", id);
    const saved = await runTransaction(db, async transaction => {
      const existing = await transaction.get(orderRef);
      if (existing.exists()) return false;
      transaction.set(orderRef, record);
      return true;
    });
    if (saved) return id;
  }

  throw new Error("Unable to generate a unique order ID. Please try again.");
}

export async function findOrder(orderId) {
  const id = orderId.trim();
  if (!/^\d{6}$/.test(id)) throw new Error("Order ID must be a 6-digit number.");
  const snapshot = await getDoc(doc(database(), "orders", id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

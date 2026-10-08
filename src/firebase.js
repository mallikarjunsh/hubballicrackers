import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, getDoc } from "firebase/firestore";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Returns { cats, discount, minOrder } or null (no Firebase config / no products yet).
export async function loadRates() {
  if (!cfg.projectId) return null;
  const db = getFirestore(getApps().length ? getApp() : initializeApp(cfg));
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

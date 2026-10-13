import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  runTransaction,
  serverTimestamp,
  query,
  where,
  updateDoc,
  getDocFromServer
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import firebaseAppletConfig from "../firebase-applet-config.json";

const cfg = {
  apiKey: firebaseAppletConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: firebaseAppletConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseAppletConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: firebaseAppletConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId,
};

export const app = getApps().length ? getApp() : initializeApp(cfg);
export const db = getFirestore(app, cfg.firestoreDatabaseId);
export const auth = getAuth(app);

// Test connection on boot per skill instructions
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firestore client is offline or connecting.");
    }
  }
}
testConnection();

// Authorized Admin Google Accounts
export const ADMIN_EMAILS = [
  "mallikarjun.hubballi@gmail.com",
  "mallikarjun.hubballi1@gmail.com"
];

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function logOutAdmin() {
  return signOut(auth);
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function isUserAdmin(user) {
  if (!user || !user.email) return false;
  const email = user.email.toLowerCase().trim();
  return ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === email);
}

const memoryOrders = new Map();

// Returns { cats, discount, minOrder } or null (no Firebase config / no products yet).
export async function loadRates() {
  if (!cfg.projectId) return null;
  try {
    const [ps, st] = await Promise.all([
      getDocs(collection(db, "products")),
      getDoc(doc(db, "settings", "shop"))
    ]);
    const rows = ps.docs
      .map(d => d.data())
      .filter(p => p.active !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!rows.length) return null;
    const cats = [];
    rows.forEach(p => {
      let c = cats.find(x => x.name === p.category);
      if (!c) {
        c = {
          id: "c" + cats.length,
          name: p.category,
          emoji: p.emoji || "🎆",
          net: !!p.net,
          items: []
        };
        cats.push(c);
      }
      c.items.push([p.name, p.unit || "1 Box", Number(p.price) || 0, p.imageUrl, p.offerPrice]);
    });
    const s = st.exists() ? st.data() : {};
    return { cats, discount: s.discount, minOrder: s.minOrder };
  } catch (err) {
    console.warn("Failed to load rates from Firestore:", err);
    return null;
  }
}

export async function saveOrder(order) {
  const localId = String(Math.floor(Math.random() * 900000) + 100000);
  const localRecord = {
    ...order,
    status: "pending_confirmation",
    createdAt: new Date().toISOString(),
  };

  // Always mirror in local stores for immediate offline resilience
  memoryOrders.set(localId, localRecord);
  try {
    const stored = JSON.parse(localStorage.getItem("mock_orders") || "{}");
    stored[localId] = localRecord;
    localStorage.setItem("mock_orders", JSON.stringify(stored));
  } catch {}
  try {
    const history = JSON.parse(localStorage.getItem("local_order_history") || "[]");
    history.unshift({ id: localId, ...localRecord });
    localStorage.setItem("local_order_history", JSON.stringify(history.slice(0, 50)));
  } catch {}

  if (!cfg.projectId) {
    return localId;
  }

  const record = {
    ...order,
    status: "pending_confirmation",
    createdAt: serverTimestamp(),
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = String(Math.floor(Math.random() * 900000) + 100000);
    const orderRef = doc(db, "orders", id);
    try {
      const saved = await runTransaction(db, async transaction => {
        const existing = await transaction.get(orderRef);
        if (existing.exists()) return false;
        transaction.set(orderRef, record);
        return true;
      });
      if (saved) {
        // Replace the temporary local-only ID with the real Firestore ID. Keeping
        // both caused duplicate entries in this browser's order history.
        const syncedRecord = { ...order, status: "pending_confirmation", createdAt: new Date().toISOString() };
        memoryOrders.delete(localId);
        memoryOrders.set(id, syncedRecord);
        try {
          const stored = JSON.parse(localStorage.getItem("mock_orders") || "{}");
          delete stored[localId];
          stored[id] = syncedRecord;
          localStorage.setItem("mock_orders", JSON.stringify(stored));
        } catch {}
        try {
          const history = JSON.parse(localStorage.getItem("local_order_history") || "[]")
            .filter(item => item?.id !== localId && item?.id !== id);
          history.unshift({ id, ...syncedRecord });
          localStorage.setItem("local_order_history", JSON.stringify(history.slice(0, 50)));
        } catch {}
        return id;
      }
    } catch (err) {
      console.warn("Firestore transaction error, returning local saved id:", err);
      return localId;
    }
  }

  return localId;
}

export async function findOrder(orderId) {
  const id = orderId.trim();
  if (!/^\d{6}$/.test(id)) throw new Error("Order ID must be a 6-digit number.");

  if (cfg.projectId) {
    try {
      const snapshot = await getDoc(doc(db, "orders", id));
      if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() };
      }
    } catch (err) {
      console.warn("Firestore findOrder error, checking local store:", err);
    }
  }

  let order = memoryOrders.get(id);
  if (!order) {
    try {
      const stored = JSON.parse(localStorage.getItem("mock_orders") || "{}");
      if (stored[id]) order = stored[id];
    } catch {}
  }
  if (!order) {
    try {
      const history = JSON.parse(localStorage.getItem("local_order_history") || "[]");
      order = history.find(o => o.id === id);
    } catch {}
  }
  return order ? { id, ...order } : null;
}

export async function findOrdersByMobile(rawMobile) {
  const mobile = String(rawMobile || "").replace(/\\D/g, "");
  if (!/^[6-9]\\d{9}$/.test(mobile)) {
    throw new Error("Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.");
  }

  // Compare using the last 10 digits so historical records containing +91,
  // spaces, or separators still match the same Indian mobile number.
  const normalizeMobile = value => {
    const digits = String(value || "").replace(/\\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
  };
  const resultsMap = new Map();

  // 1. Search in-memory store
  for (const [id, ord] of memoryOrders.entries()) {
    if (normalizeMobile(ord?.customer?.mobile) === mobile) {
      resultsMap.set(id, { id, ...ord });
    }
  }

  // 2. Search mock_orders in localStorage
  try {
    const mockOrders = JSON.parse(localStorage.getItem("mock_orders") || "{}");
    for (const [id, ord] of Object.entries(mockOrders)) {
      if (normalizeMobile(ord?.customer?.mobile) === mobile && !resultsMap.has(id)) {
        resultsMap.set(id, { id, ...ord });
      }
    }
  } catch {}

  // 3. Search local_order_history in localStorage
  try {
    const history = JSON.parse(localStorage.getItem("local_order_history") || "[]");
    for (const ord of history) {
      if (normalizeMobile(ord?.customer?.mobile) === mobile && ord?.id && !resultsMap.has(ord.id)) {
        resultsMap.set(ord.id, ord);
      }
    }
  } catch {}

  // 4. Query Firestore. Try exact matches first, then common historical formats.
  // Do not report "no orders" when the database query itself failed.
  let firestoreError = null;
  if (cfg.projectId) {
    try {
      const exactQuery = query(collection(db, "orders"), where("customer.mobile", "==", mobile));
      const exactSnapshot = await getDocs(exactQuery);
      exactSnapshot.forEach(docSnap => {
        resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      });

      if (exactSnapshot.empty) {
        const withFormatting = [
          mobile,
          `+91${mobile}`,
          `+91 ${mobile}`,
          `+91-${mobile}`,
          `91${mobile}`,
          `91 ${mobile}`,
          `0${mobile}`,
          `${mobile.slice(0, 5)} ${mobile.slice(5)}`,
          `${mobile.slice(0, 5)}-${mobile.slice(5)}`,
          `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`,
          `91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`,
        ];
        const variantQuery = query(
          collection(db, "orders"),
          where("customer.mobile", "in", [...new Set(withFormatting)])
        );
        const variantSnapshot = await getDocs(variantQuery);
        variantSnapshot.forEach(docSnap => {
          const order = { id: docSnap.id, ...docSnap.data() };
          if (normalizeMobile(order?.customer?.mobile) === mobile) {
            resultsMap.set(docSnap.id, order);
          }
        });
      }
    } catch (err) {
      firestoreError = err;
      console.warn("Unable to fetch orders from Firestore by mobile:", err);
    }
  }

  const list = Array.from(resultsMap.values());
  if (list.length === 0 && firestoreError) {
    throw new Error("We couldn't reach the order database. Please check your connection and try again; this does not confirm that you have no orders.");
  }

  list.sort((a, b) => {
    const getTs = item => {
      if (item?.createdAt?.toDate) return item.createdAt.toDate().getTime();
      if (item?.createdAt?.seconds) return item.createdAt.seconds * 1000;
      if (typeof item?.createdAt === "string") return new Date(item.createdAt).getTime();
      return 0;
    };
    return getTs(b) - getTs(a);
  });

  return list;
}

export async function loadAllOrders() {
  const resultsMap = new Map();

  // 1. Search in-memory store
  for (const [id, ord] of memoryOrders.entries()) {
    resultsMap.set(id, { id, ...ord });
  }

  // 2. Search mock_orders in localStorage
  try {
    const mockOrders = JSON.parse(localStorage.getItem("mock_orders") || "{}");
    for (const [id, ord] of Object.entries(mockOrders)) {
      if (!resultsMap.has(id)) {
        resultsMap.set(id, { id, ...ord });
      }
    }
  } catch {}

  // 3. Search local_order_history in localStorage
  try {
    const history = JSON.parse(localStorage.getItem("local_order_history") || "[]");
    for (const ord of history) {
      if (ord?.id && !resultsMap.has(ord.id)) {
        resultsMap.set(ord.id, ord);
      }
    }
  } catch {}

  // 4. Query Firestore if configured
  if (cfg.projectId) {
    try {
      const snapshot = await getDocs(collection(db, "orders"));
      snapshot.forEach(docSnap => {
        resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      });
    } catch (err) {
      console.warn("Unable to fetch all orders from Firestore:", err);
    }
  }

  const list = Array.from(resultsMap.values());
  list.sort((a, b) => {
    const getTs = item => {
      if (item?.createdAt?.toDate) return item.createdAt.toDate().getTime();
      if (item?.createdAt?.seconds) return item.createdAt.seconds * 1000;
      if (typeof item?.createdAt === "string") return new Date(item.createdAt).getTime();
      return 0;
    };
    return getTs(b) - getTs(a);
  });

  return list;
}

export async function updateOrder(orderId, updates) {
  const id = String(orderId || "").trim();
  if (!id) throw new Error("Order ID is required.");

  // 1. Update in memoryOrders
  if (memoryOrders.has(id)) {
    memoryOrders.set(id, { ...memoryOrders.get(id), ...updates });
  }

  // 2. Update in mock_orders
  try {
    const mockOrders = JSON.parse(localStorage.getItem("mock_orders") || "{}");
    if (mockOrders[id]) {
      mockOrders[id] = { ...mockOrders[id], ...updates };
      localStorage.setItem("mock_orders", JSON.stringify(mockOrders));
    }
  } catch {}

  // 3. Update in local_order_history
  try {
    const history = JSON.parse(localStorage.getItem("local_order_history") || "[]");
    const idx = history.findIndex(o => o.id === id);
    if (idx !== -1) {
      history[idx] = { ...history[idx], ...updates };
      localStorage.setItem("local_order_history", JSON.stringify(history));
    }
  } catch {}

  // 4. Update in Firestore if configured
  if (cfg.projectId) {
    try {
      await updateDoc(doc(db, "orders", id), updates);
    } catch (err) {
      console.warn("Failed to update order in Firestore:", err);
    }
  }

  return true;
}

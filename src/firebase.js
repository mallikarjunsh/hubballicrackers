import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDocs,
  getDoc,
  runTransaction,
  serverTimestamp,
  query,
  where,
  updateDoc,
  setDoc,
  deleteDoc,
  getDocFromServer
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";
import firebaseAppletConfig from "../firebase-applet-config.json";

const cfg = {
  apiKey: firebaseAppletConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: firebaseAppletConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseAppletConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: firebaseAppletConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: firebaseAppletConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId,
};

export const app = getApps().length ? getApp() : initializeApp(cfg);
// Orders live in the project's `(default)` Firestore database.
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app, cfg.storageBucket ? `gs://${cfg.storageBucket}` : undefined);

const analyticsSessionId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function trackSiteEvent(eventName, details = {}) {
  if (!cfg.projectId || !eventName) return;
  try {
    await addDoc(collection(db, "siteAnalytics"), {
      event: String(eventName),
      sessionId: analyticsSessionId,
      path: window.location.pathname,
      createdAt: serverTimestamp(),
      ...details,
    });
  } catch (error) {
    console.warn("Analytics event could not be saved:", error);
  }
}

export async function loadAnalyticsSummary() {
  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  const snapshot = await getDocs(collection(db, "siteAnalytics"));
  const counts = { view_product: 0, add_to_cart: 0, start_order: 0, submit_order: 0 };
  const products = {};
  snapshot.docs.forEach(item => {
    const data = item.data();
    if (counts[data.event] !== undefined) counts[data.event] += 1;
    if (data.event === "view_product" && data.product) products[data.product] = (products[data.product] || 0) + 1;
  });
  return { counts, products: Object.entries(products).sort((a, b) => b[1] - a[1]).slice(0, 10), totalEvents: snapshot.size };
}

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
  "mallikarjun.hubballi1@gmail.com",
  "veereshhubballi789@gmail.com",
  "praveensi7026503043@gmail.com",
  "ingalahallivinayak@gmail.com"
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

const ratesCache = new Map();
const ratesInFlight = new Map();

// Returns { cats, discount, minOrder } or null (no Firebase config / no products yet).
export async function loadRates(options = {}) {
  if (!cfg.projectId) return null;
  const includeInactive = Boolean(options.includeInactive);
  const ratesCacheKey = includeInactive ? "all" : "active";
  const cachedRates = ratesCache.get(ratesCacheKey);
  if (cachedRates && Date.now() - cachedRates.loadedAt < 60_000) return cachedRates.value;
  if (ratesInFlight.has(ratesCacheKey)) return ratesInFlight.get(ratesCacheKey);
  const request = (async () => {
  try {
    const [ps, st] = await Promise.all([
      getDocs(collection(db, "products")),
      getDoc(doc(db, "settings", "shop"))
    ]);
    const rows = ps.docs
      .map(d => d.data())
      .filter(p => includeInactive || p.active !== false)
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
      c.items.push([p.name, p.unit || "1 Box", Number(p.price) || 0, p.imageUrl, p.offerPrice, Number(p.stockQuantity) || 0, Number(p.lowStockThreshold) || 5, p.active !== false, Number(p.itemsPerCase) || 1, p.variant || "", p.customerName || p.name]);
    });
    cats.sort((a, b) => {
      if (a.name === "One Sound Crackers") return 1;
      if (b.name === "One Sound Crackers") return -1;
      return 0;
    });
    const s = st.exists() ? st.data() : {};
    const value = { cats, discount: s.discount, minOrder: s.minOrder };
    ratesCache.set(ratesCacheKey, { value, loadedAt: Date.now() });
    return value;
  } catch (err) {
    console.warn("Failed to load rates from Firestore:", err);
    return null;
  }
  })();
  ratesInFlight.set(ratesCacheKey, request);
  try { return await request; } finally { ratesInFlight.delete(ratesCacheKey); }
}

export async function loadInventory() {
  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  const snapshot = await getDocs(collection(db, "inventory"));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function updateInventory(productName, shop, casesReceived, piecesReceived, pendingCases, pendingPieces) {
  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  const productId = productDocumentId(productName);
  const shopId = String(shop || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (!productId || !shopId) throw new Error("Product and shop are required.");
  const cases = Math.max(0, Number(casesReceived) || 0);
  const pieces = Math.max(0, Number(piecesReceived) || 0);
  const casesPending = Math.max(0, Number(pendingCases) || 0);
  const piecesPending = Math.max(0, Number(pendingPieces) || 0);
  await setDoc(doc(db, "inventory", `${productId}--${shopId}`), {
    productName, shop, casesReceived: cases, piecesReceived: pieces, pendingCases: casesPending, pendingPieces: piecesPending, updatedAt: serverTimestamp()
  }, { merge: true });
  return { productName, shop, casesReceived: cases, piecesReceived: pieces, pendingCases: casesPending, pendingPieces: piecesPending };
}

export async function saveOrder(order) {
  if (!cfg.projectId) throw new Error("Firebase is not configured.");

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
        return id;
      }
    } catch (err) {
      console.warn("Firestore transaction error:", err);
      throw err;
    }
  }

  throw new Error("Unable to create a unique order ID. Please try again.");
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
      console.warn("Firestore findOrder error:", err);
      throw err;
    }
  }
  return null;
}

export async function findOrdersByMobile(rawMobile) {
  const mobile = String(rawMobile || "").replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw new Error("Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.");
  }

  // Compare using the last 10 digits so historical records containing +91,
  // spaces, or separators still match the same Indian mobile number.
  const normalizeMobile = value => {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
  };
  const resultsMap = new Map();

  // Query Firestore. Try exact matches first, then common historical formats.
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
  // Query Firestore only. Order management must reflect database state.
  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  try {
    const snapshot = await getDocs(collection(db, "orders"));
    snapshot.forEach(docSnap => {
      resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
    });
  } catch (err) {
    console.warn("Unable to fetch all orders from Firestore:", err);
    throw new Error(`Unable to load orders from Firestore (${err.code || "unknown error"}).`);
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

  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "orders", id), updates);
  return true;
}

export async function updateProductStock(productName, stockQuantity, lowStockThreshold) {
  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  const id = String(productName || "")
    .normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!id) throw new Error("Product name is required.");
  await updateDoc(doc(db, "products", id), {
    stockQuantity: Math.max(0, Number(stockQuantity) || 0),
    lowStockThreshold: Math.max(0, Number(lowStockThreshold) || 0),
  });
}

export async function updateProductActive(productName, active) {
  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  const id = productDocumentId(productName);
  if (!id) throw new Error("Product name is required.");
  await updateDoc(doc(db, "products", id), { active: Boolean(active) });
}

function productDocumentId(productName) {
  return String(productName || "")
    .normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function updateProductDetails(productName, { price, offerPrice, category, imageUrl, itemsPerCase, customerName, unit }) {
  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  const id = productDocumentId(productName);
  const listedPrice = Number(price);
  if (!id || !Number.isFinite(listedPrice) || listedPrice < 0) throw new Error("A valid product rate is required.");
  const parsedOffer = offerPrice === "" || offerPrice === null || offerPrice === undefined ? null : Number(offerPrice);
  if (parsedOffer !== null && (!Number.isFinite(parsedOffer) || parsedOffer < 0)) throw new Error("Offer rate must be a valid positive number or blank.");
  await updateDoc(doc(db, "products", id), {
    price: listedPrice,
    offerPrice: parsedOffer,
    ...(category ? { category: String(category).trim() } : {}),
    ...(imageUrl !== undefined ? { imageUrl: String(imageUrl || "").trim() || null } : {}),
    ...(itemsPerCase !== undefined ? { itemsPerCase: Math.max(1, Number(itemsPerCase) || 1) } : {}),
    ...(customerName !== undefined ? { customerName: String(customerName || productName).trim() || productName } : {}),
    ...(unit !== undefined ? { unit: String(unit || "1 Box").trim() || "1 Box" } : {}),
  });
}

function fileToFirestoreImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("The image could not be decoded."));
      image.onload = () => {
        const maxSide = 1200;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        const qualities = [0.78, 0.64, 0.5, 0.38];
        const attempt = index => {
          const dataUrl = canvas.toDataURL("image/jpeg", qualities[index]);
          if (dataUrl.length <= 860000 || index === qualities.length - 1) {
            if (dataUrl.length > 860000) reject(new Error("Image is too large even after compression."));
            else resolve(dataUrl);
            return;
          }
          attempt(index + 1);
        };
        attempt(0);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadProductImage(productName, file, options = {}) {
  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  if (!(file instanceof File)) throw new Error("Choose an image file first.");
  if (!file.type.startsWith("image/")) throw new Error("Only image files can be uploaded.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be smaller than 5 MB.");
  const id = productDocumentId(productName);
  if (!id) throw new Error("Product name is required.");
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  let imageUrl;
  if (options.preferFirestore) {
    imageUrl = await fileToFirestoreImage(file);
  } else {
    try {
      const imageRef = storageRef(storage, `product-images/${id}-${Date.now()}-${safeName}`);
      await uploadBytes(imageRef, file, { contentType: file.type, cacheControl: "public,max-age=3600" });
      imageUrl = await getDownloadURL(imageRef);
    } catch (error) {
      if (options.firestoreFallback === false) throw error;
      console.warn("Firebase Storage upload failed; using a compressed Firestore image instead:", error);
      imageUrl = await fileToFirestoreImage(file);
    }
  }
  if (options.saveToProduct !== false) await updateDoc(doc(db, "products", id), { imageUrl });
  return imageUrl;
}

export async function renameProduct(oldName, newName) {
  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  const oldId = productDocumentId(oldName);
  const newProductName = String(newName || "").trim();
  const newId = productDocumentId(newProductName);
  if (!oldId || !newId || !newProductName) throw new Error("A valid product name is required.");
  if (oldId === newId) return;
  const oldRef = doc(db, "products", oldId);
  const oldSnapshot = await getDoc(oldRef);
  if (!oldSnapshot.exists()) throw new Error("The original product was not found.");
  const newRef = doc(db, "products", newId);
  const existing = await getDoc(newRef);
  if (existing.exists()) throw new Error("A product with that name already exists.");
  await setDoc(newRef, { ...oldSnapshot.data(), name: newProductName });
  await deleteDoc(oldRef);
}

export async function createProduct({ name, customerName, variant, category, unit, price, offerPrice, imageUrl, emoji, net, itemsPerCase }) {
  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  const productName = String(name || "").trim();
  const productCategory = String(category || "").trim();
  const id = productDocumentId(productName);
  const listedPrice = Number(price);
  if (!id || !productCategory || !Number.isFinite(listedPrice) || listedPrice < 0) throw new Error("Name, category, and a valid rate are required.");
  const parsedOffer = offerPrice === "" || offerPrice === null || offerPrice === undefined ? null : Number(offerPrice);
  if (parsedOffer !== null && (!Number.isFinite(parsedOffer) || parsedOffer < 0)) throw new Error("Offer rate must be a valid positive number or blank.");
  await setDoc(doc(db, "products", id), {
    name: productName,
    customerName: String(customerName || productName).trim(),
    variant: String(variant || "").trim(),
    category: productCategory,
    unit: String(unit || "1 Box").trim(),
    price: listedPrice,
    offerPrice: parsedOffer,
    imageUrl: String(imageUrl || "").trim() || null,
    emoji: String(emoji || "🎆"),
    net: Boolean(net),
    active: true,
    order: Date.now(),
    stockQuantity: 0,
    lowStockThreshold: 5,
    itemsPerCase: Math.max(1, Number(itemsPerCase) || 1),
  });
  return { id, name: productName, customerName: String(customerName || productName).trim(), variant: String(variant || "").trim(), category: productCategory, unit: String(unit || "1 Box").trim(), price: listedPrice, offerPrice: parsedOffer, imageUrl: String(imageUrl || "").trim() || undefined, emoji: String(emoji || "🎆"), net: Boolean(net), stockQuantity: 0, lowStockThreshold: 5, itemsPerCase: Math.max(1, Number(itemsPerCase) || 1) };
}

export async function confirmOrderAndDeductStock(order, updates = {}) {
  if (!cfg.projectId) throw new Error("Firebase is not configured.");
  const orderRef = doc(db, "orders", String(order.id));
  const items = Array.isArray(order.items) ? order.items : [];
  const productRefs = items.map(item => {
    const id = String(item.name || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { item, ref: doc(db, "products", id) };
  });
  await runTransaction(db, async transaction => {
    const productSnapshots = [];
    for (const product of productRefs) productSnapshots.push(await transaction.get(product.ref));
    for (let i = 0; i < productRefs.length; i += 1) {
      const snapshot = productSnapshots[i];
      const quantity = Number(productRefs[i].item.quantity) || 0;
      const available = Number(snapshot.data()?.stockQuantity) || 0;
      if (!snapshot.exists() || available < quantity) throw new Error(`Insufficient stock for ${productRefs[i].item.name}. Available: ${available}.`);
      transaction.update(productRefs[i].ref, { stockQuantity: available - quantity });
    }
    transaction.update(orderRef, { ...updates, status: "confirmed", stockDeducted: true, stockDeductedAt: new Date().toISOString() });
  });
}

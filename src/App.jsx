import { useState, useMemo, useEffect } from "react";
import {
  loadRates,
  saveOrder,
  findOrder,
  findOrdersByMobile,
  loadAllOrders,
  updateOrder,
  signInWithGoogle,
  logOutAdmin,
  subscribeToAuth,
  isUserAdmin,
  ADMIN_EMAILS
} from "./firebase";
import PRODUCT_IMAGE_MANIFEST from "./productImages.json";
let DISC = 0.2; // 20% off the listed price
const SHOP = "Hubballi Crackers";
const SHOP_EMAIL = "mallikarjun.hubballi1@gmail.com";
const PHONES = ["7845601428", "7676504117", "8660786076", "7676052027"];
const ASSET_BASE = import.meta.env.BASE_URL;
const LOGO = `${ASSET_BASE}logo.webp`;
const CAROUSEL = [
  { title: "Festival Fireworks", subtitle: "Premium Deepavali crackers for a bright and joyful celebration", image: `${ASSET_BASE}deepavali-fireworks.png` },
  { title: "Sparklers & Lights", subtitle: "South Indian festive glow for family gatherings and celebrations", image: `${ASSET_BASE}deepavali-sparklers.png` },
  { title: "Diwali Delight", subtitle: "Family moments, bright lights, and crackers to light up the night", image: `${ASSET_BASE}deepavali-family.png` }
];
const PRODUCT_IMAGES = Object.fromEntries(Object.entries(PRODUCT_IMAGE_MANIFEST).map(([name, image]) => [
  name,
  new URL(`${ASSET_BASE}product-images/${image.file}`, window.location.href).href
]));
const LOCAL_PRODUCT_IMAGES = {
  "15 Shot Multi Color": "product-images/15-shot-multicolour.jpg",
  "F.P. Asoka (10 Pcs)": "product-images/flower-pots-asoka.jpg",
  "Ashwini Box": "product-images/goa-ashwini-box.jpg",
  "Rainbow Spinner Special (Sunshine)": "product-images/RainbowSpinnerSpecial.jpg",
  "Rainbow Spinner Deluxe (Sunshine)": "product-images/Rainbow Spinner Deluxe (Sunshine).jpg",
  "Sun Drop": "product-images/sundrop.jpg",
  "Moon Drop": "product-images/moondrop.jpg",
};
// Force product photos to be revalidated on every page load. The timestamp is
// stable for this page session, so React re-renders do not trigger extra loads.
const PRODUCT_IMAGE_REVISION = Date.now().toString();
const pendingProductImages = new Map();
const getCachedProductImage = source => {
  let pending = pendingProductImages.get(source);
  if (!pending) {
    pending = (async () => {
      const imageUrl = new URL(source, window.location.href);
      imageUrl.searchParams.set("v", PRODUCT_IMAGE_REVISION);
      if (imageUrl.origin !== window.location.origin) {
        await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = resolve;
          image.onerror = () => reject(new Error("Image request failed"));
          image.src = imageUrl.href;
        });
        return { src: imageUrl.href, fromCache: false, cacheable: false };
      }
      const response = await fetch(imageUrl.href, { cache: "no-store" });
      if (!response.ok) throw new Error("Image request failed");
      return { blob: await response.blob(), fromCache: false, cacheable: false };
    })().finally(() => pendingProductImages.delete(source));
    pendingProductImages.set(source, pending);
  }
  return pending.then(({ blob, fromCache, cacheable }) => ({
    src: blob ? URL.createObjectURL(blob) : source,
    fromCache,
    cacheable,
  }));
};
let MIN = { "Karnataka": 1000, "Maharashtra": 3000, "Goa": 3000 };
// [name, unit, printed price, image URL, optional offer price]
const FALLBACK_DATA = [
  { id: "combo", name: "Premium Combo Packs", emoji: "🎁", net: true, items: [["Combo Pack - Starter", "1 Box", 3000], ["Combo Pack - Hero", "1 Box", 5000], ["Combo Pack - Legend", "4 Box", 10000]] },
  { id: "sound", name: "One Sound Crackers", emoji: "💥", items: [["2⅞' Kuruvi", "1 Pkt", 35], ["3½' Lakshmi", "1 Pkt", 70], ["4' Deluxe Lakshmi", "1 Pkt", 175], ["Red Bijili (100 Pcs)", "1 Pkt", 185]] },
  { id: "spark", name: "Sparklers", emoji: "✨", items: [["10 Cm Sparklers", "1 Box", 50, "product-images/electric-sparklers-12cm.webp", 30], ["15 Cm Sparklers", "1 Box", 100, "product-images/green-sparklers-15cm.webp", 50], ["30 Cm Sparklers", "1 Box", 120, "product-images/red-sparklers-30cm.webp", 70], ["50 Cm Sparklers", "1 Box", 250, null, 200]] },
  { id: "chakkar", name: "Ground Chakkars", emoji: "🌀", items: [["Ground Chakkar Big (10 Pcs)", "1 Box (10 Pcs)", 400, null, 320], ["Ground Chakkar Deluxe (10 Pcs)", "1 Box (10 Pcs)", 300, null, 180], ["Rainbow Spinner Special (Sunshine)", "1 Box (10 Pcs)", 400, "product-images/RainbowSpinnerSpecial.jpg", 300], ["Rainbow Spinner Deluxe (Sunshine)", "1 Box (10 Pcs)", 300, "product-images/Rainbow Spinner Deluxe (Sunshine).jpg", 180]] },
  { id: "flower-pots", name: "Flower Pots", emoji: "🌼", items: [["Flower Pots Special (10 Pcs)", "1 Box", 500, null, 150], ["Flower Pots Deluxe (5 Pcs)", "1 Box", 1250, null, 550], ["F.P. Asoka (10 Pcs)", "1 Box (10 Pcs)", 700, "product-images/flower-pots-asoka.jpg", 180], ["Colour Koti (10 Pcs)", "1 Box (10 Pcs)", 1250, "https://r2.sriseosolutions.com/mtpcrackers.in/upload/1789111807_6aa3adffbcce4.webp", 300]] },
  { id: "kids", name: "Kids Attractions", emoji: "🧒", items: [["Butterfly (10 Pcs)", "1 Box", 200, "product-images/butterfly-18.webp", 140], ["Helicopter (5 Pcs)", "1 Box", 200, "product-images/helicopter-5.webp", 140], ["Photo Flash Sticks (5 Pcs)", "1 Box", 800, "product-images/photo-flash-sticks-5.webp", 400], ["Mega Siren", "1 Box", 1000, "product-images/mega-siren.webp", 400], ["Little Peacock", "1 Box", 250, null, 200], ["Rising Peacock", "1 Box", 350, null, 250], ["Bada Peacock", "1 Box", 650, null, 500], ["Pop Pop", "1 Pkt", 10, "product-images/poppop.jpeg"], ["Bidi Pop", "1 Pkt", 15, "product-images/bidipop.jpg"], ["Chitputhi - Small", "1 Box", 90, "product-images/chitput-small.jpg", 70], ["Chitputhi - Big", "1 Box", 120, "product-images/kit-kat-chittu-puttu-10pcs-box-big.jpg", 100]] },
  { id: "fount", name: "Fancy Fountains", emoji: "⛲", items: [["Golden Elephant", "1 Pce", 1500], ["Lucky Lion", "1 Pce", 2000], ["Strawberry Cone Fountain", "1 Pce", 1200], ["Tricolour Fountains (5 Pcs)", "1 Box", 1500], ["Spark Showers (5 Pcs)", "1 Box", 620, "https://r2.sriseosolutions.com/mtpcrackers.in/upload/1789126103_6aa3e5d792320.webp", 124], ["Sun Drop", "1 Box", 230, "product-images/sundrop.jpg", 140], ["Moon Drop", "1 Box", 230, "product-images/moondrop.jpg", 140]] },
  { id: "rocket", name: "Rockets & Bombs", emoji: "🚀", items: [["Musical Rocket", "1 Box", 1000], ["Two Sound Rocket", "1 Box", 1000], ["Hydro Bomb (10 Pcs)", "1 Box", 450], ["1/2 kg Paper Bomb", "1 Pce", 500], ["Hydro Bomb", "1 Box", 270, "product-images/hydro-bomb.png", 160], ["777 Agni Bomb", "1 Box", 370, "product-images/777-agni-bomb.png", 240], ["Shell Bomb - ARD", "1 Box", 400, null, 340]] },
  { id: "night", name: "Multicolour Night Shots", emoji: "🎆", items: [["12 Shot Multi Color", "1 Box", 450, null, 340], ["15 Shot Multi Color", "1 Box", 550, "product-images/15-shot-multicolour.jpg", 430], ["30 Shot Multi Color", "1 Box", 770, "product-images/shots-30-multicolour.webp", 650], ["60 Shot Multi Color", "1 Box", 1250, "product-images/shots-60-multicolour.webp", 1050], ["120 Shot Multi Color", "1 Box", 2350, "product-images/shots-120-multicolour.webp", 1840], ["240 Shot Multi Color", "1 Box", 4550, null, 3540]] },
  { id: "single-shots", name: "Single Shots", emoji: "🎆", items: [["Single Shots - 2 inch (3 Pieces) - Narayan", "1 Box", 600, null, 440], ["Single Shots - 3 inch - Supreme", "1 Box", 600, null, 490], ["Single Shots - 4 inch - VB", "1 Box", 700, null, 540]] },
  { id: "garland", name: "Festival Garlands", emoji: "🎊", items: [["1000 Wala", "1 Box", 300, "product-images/kmr-1000-wala.jpg", 250], ["2000 Wala", "1 Box", 550, "product-images/kmr-2000-wala.jpg", 460], ["5000 Wala", "1 Box", 1100, "product-images/kmr-5000-wala.jpg", 900], ["10000 Wala", "1 Box", 2150, "product-images/kmr-10000-wala.jpg", 1800]] },
  { id: "goa", name: "Goa", emoji: "🎆", net: true, items: [["Ashwini", "1 Box", 650], ["Ashwini Box", "1 Box", 700, "product-images/goa-ashwini-box.jpg"], ["ARD", "1 Box", 850, "product-images/ard.avif"]] },
  { id: "gift", name: "Gift Boxes", emoji: "🧧", items: [["20 Item Gift Box", "1 Box", 1750], ["30 Item Gift Box", "1 Box", 3000], ["50 Item Gift Box", "1 Box", 5500]] },
];
const offer = (cat, p, offerPrice) => (offerPrice ?? (cat.net ? p : Math.round(p * (1 - DISC))));
const inr = n => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const load = () => { try { return JSON.parse(localStorage.getItem("spp-cart") || "{}"); } catch (e) { return {}; } };

function formatOrderDate(val) {
  if (!val) return "Recent";
  try {
    const date = val?.toDate ? val.toDate() : val?.seconds ? new Date(val.seconds * 1000) : new Date(val);
    if (isNaN(date.getTime())) return "Recent";
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "Recent";
  }
}

function getStatusInfo(status) {
  switch (status) {
    case "pending_confirmation":
      return { label: "Pending Confirmation", className: "order-badge-pending", icon: "⏳" };
    case "confirmed":
      return { label: "Confirmed", className: "order-badge-confirmed", icon: "✅" };
    case "dispatched":
      return { label: "Dispatched", className: "order-badge-dispatched", icon: "🚚" };
    case "delivered":
      return { label: "Delivery Successful", className: "order-badge-delivered", icon: "🎉" };
    case "cancelled":
      return { label: "Cancelled", className: "order-badge-cancelled", icon: "❌" };
    default:
      return { label: status || "Submitted", className: "order-badge-pending", icon: "📋" };
  }
}

function Qty({ v, set }) {
  const [sparkId, setSparkId] = useState(0);

  return (
    <div className="qty">
      <button type="button" aria-label="Decrease quantity" onClick={() => set(Math.max(0, v - 1))}>−</button>
      <input inputMode="numeric" value={v || ""} placeholder="0" onChange={e => set(Math.max(0, parseInt(e.target.value.replace(/\D/g, "")) || 0))} />
      <button type="button" className="qty-add-button" aria-label="Increase quantity" onClick={() => { set(v + 1); setSparkId(id => id + 1); }}>
        +{sparkId > 0 && <span key={sparkId} className="qty-spark-burst" aria-hidden="true" />}
      </button>
    </div>
  );
}

function HeroCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = setInterval(() => {
      setActive(i => (i + 1) % CAROUSEL.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="carousel" aria-label="Featured products carousel">
      <div className="carousel-track" style={{ transform: `translateX(-${active * 100}%)` }}>
        {CAROUSEL.map(slide => (
          <div className="carousel-slide" key={slide.title}>
            <img src={slide.image} alt={slide.title} />
            <div className="carousel-overlay">
              <span>Hubballi Crackers · ಹುಬ್ಬಳ್ಳಿ ಕ್ರ್ಯಾಕರ್ಸ್</span>
              <h2>{slide.title}</h2>
              <p>{slide.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="carousel-dots" aria-label="Carousel navigation">
        {CAROUSEL.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            className={index === active ? "dot active" : "dot"}
            onClick={() => setActive(index)}
            aria-label={`Show slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [DATA, setData] = useState([]);
  const [live, setLive] = useState("loading");
  const [showBrandIntro, setShowBrandIntro] = useState(true);
  const [chromeHidden, setChromeHidden] = useState(false);
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setShowBrandIntro(false), reducedMotion ? 50 : 1800);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 24) setChromeHidden(false);
      else if (y > lastY + 4) setChromeHidden(true);
      else if (y < lastY - 4) setChromeHidden(false);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    loadRates().then(r => {
      if (!r || !Array.isArray(r.cats) || r.cats.length === 0) {
        setLive("error");
        return;
      }
      if (typeof r.discount === "number") DISC = r.discount;
      if (r.minOrder) MIN = r.minOrder;
      setData(r.cats);
      setLive("live");
    }).catch(() => setLive("error"));
  }, []);
  const [cart, setCart] = useState(load);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [step, setStep] = useState("list");
  const [f, setF] = useState({ state: "", city: "", name: "", mobile: "", email: "", address: "" });
  const [touched, setTouched] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productImage, setProductImage] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [lookupState, setLookupState] = useState({ status: "idle" });
  const [historyMobile, setHistoryMobile] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [historyState, setHistoryState] = useState({ status: "idle", orders: [] });
  const [expandedOrderIds, setExpandedOrderIds] = useState(new Set());
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminFilter, setAdminFilter] = useState("all");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminSort, setAdminSort] = useState("date_desc");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionToast, setActionToast] = useState(null);
  const [editingTrackingId, setEditingTrackingId] = useState(null);
  const [trackingNotes, setTrackingNotes] = useState({});
  const [paymentModes, setPaymentModes] = useState({});
  const [adminExpandedIds, setAdminExpandedIds] = useState(new Set());
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuth(user => {
      setCurrentUser(user);
      setAuthChecking(false);
      if (user && !isUserAdmin(user)) {
        setAuthError("This Google account does not have administrator privileges. Please sign in with the authorized store owner account.");
      } else {
        setAuthError("");
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    setAuthError("");
    try {
      const userCred = await signInWithGoogle();
      if (!isUserAdmin(userCred.user)) {
        setAuthError("This Google account does not have administrator privileges. Please sign in with the authorized store owner account.");
      }
    } catch (err) {
      console.error("Google login error:", err);
      if (err.code === "auth/popup-blocked") {
        setAuthError("Sign-in popup was blocked by your browser. Please allow popups for this site and try again.");
      } else if (err.code === "auth/popup-closed-by-user") {
        setAuthError("Sign-in was closed before completion.");
      } else if (err.code === "auth/unauthorized-domain") {
        setAuthError("This site is not authorized for Google sign-in. Add the current website domain under Firebase Console → Authentication → Settings → Authorized domains.");
      } else {
        setAuthError(err.message || "Failed to sign in with Google. Please try again.");
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await logOutAdmin();
      setAuthError("");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const loadAdminOrders = async () => {
    setAdminLoading(true);
    setAdminError("");
    try {
      const list = await loadAllOrders();
      setAdminOrders(list);
    } catch (err) {
      console.error("Admin orders load error:", err);
      setAdminError(err.message || "Failed to load orders");
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === "#admin") {
        setStep("admin");
        window.scrollTo(0, 0);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    if (step === "admin" && currentUser && isUserAdmin(currentUser)) {
      loadAdminOrders();
    }
  }, [step, currentUser]);

  const handleMarkPaid = async (order, forcedStatus) => {
    const nextPaid = forcedStatus !== undefined ? forcedStatus : !order.paid;
    setActionLoadingId(order.id);
    const mode = paymentModes[order.id] || order.paymentMode || "UPI / GPay / PhonePe";
    const updates = {
      paid: nextPaid,
      paymentStatus: nextPaid ? "paid" : "unpaid",
      paymentMode: nextPaid ? mode : null,
      paidAt: nextPaid ? new Date().toISOString() : null
    };
    try {
      await updateOrder(order.id, updates);
      setAdminOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...updates } : o));
      setActionToast({
        type: "success",
        text: nextPaid
          ? `Order #${order.id} marked as Paid (${mode})!`
          : `Order #${order.id} marked as Unpaid.`
      });
      setTimeout(() => setActionToast(null), 3500);
    } catch (err) {
      setActionToast({ type: "error", text: "Failed to update payment: " + err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkDeliverySuccessful = async (order) => {
    setActionLoadingId(order.id);
    const updates = {
      status: "delivered",
      deliveredAt: new Date().toISOString()
    };
    try {
      await updateOrder(order.id, updates);
      setAdminOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...updates } : o));
      setActionToast({
        type: "success",
        text: `🎉 Order #${order.id} marked as Delivery Successful!`
      });
      setTimeout(() => setActionToast(null), 3500);
    } catch (err) {
      setActionToast({ type: "error", text: "Failed to update delivery: " + err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateStatus = async (order, newStatus, customNote) => {
    setActionLoadingId(order.id);
    const note = customNote !== undefined ? customNote : (trackingNotes[order.id] ?? order.deliveryNote ?? "");
    const updates = {
      status: newStatus,
      deliveryNote: note,
      statusUpdatedAt: new Date().toISOString()
    };
    if (newStatus === "delivered") {
      updates.deliveredAt = new Date().toISOString();
    }
    try {
      await updateOrder(order.id, updates);
      setAdminOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...updates } : o));
      setEditingTrackingId(null);
      setActionToast({
        type: "success",
        text: `Order #${order.id} status updated to ${getStatusInfo(newStatus).label}!`
      });
      setTimeout(() => setActionToast(null), 3500);
    } catch (err) {
      setActionToast({ type: "error", text: "Failed to update status: " + err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleAdminExpand = id => {
    setAdminExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateDemoOrder = async () => {
    setActionLoadingId("demo");
    try {
      const demoOrder = {
        customer: {
          name: "Mallikarjun Patil",
          mobile: "7845601428",
          email: "",
          city: "Hubballi",
          state: "Karnataka",
          address: "Shop No. 12, Station Road, Hubballi 580020"
        },
        items: [
          { name: "Combo Pack - Starter", unit: "1 Box", quantity: 1, unitPrice: 3000, total: 3000 },
          { name: "1000 Wala", unit: "1 Box", quantity: 2, unitPrice: 250, total: 500 },
          { name: "Ground Chakkar Deluxe (10 Pcs)", unit: "1 Box (10 Pcs)", quantity: 2, unitPrice: 180, total: 360 }
        ],
        net: 3860,
        packing: 116,
        savings: 640,
        total: 3976,
        paid: false,
        status: "pending_confirmation"
      };
      const id = await saveOrder(demoOrder);
      await loadAdminOrders();
      setActionToast({ type: "success", text: `Demo order #${id} created! You can now test marking it Paid or Delivery Successful.` });
      setTimeout(() => setActionToast(null), 4000);
    } catch (err) {
      setActionToast({ type: "error", text: "Failed to create demo order: " + err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const adminStats = useMemo(() => {
    const totalOrders = adminOrders.length;
    const totalRevenue = adminOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const paidList = adminOrders.filter(o => o.paid === true || o.paymentStatus === "paid");
    const paidOrders = paidList.length;
    const paidRevenue = paidList.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const unpaidRevenue = totalRevenue - paidRevenue;
    const pendingOrders = adminOrders.filter(o => !o.status || o.status === "pending_confirmation").length;
    const confirmedOrders = adminOrders.filter(o => o.status === "confirmed").length;
    const dispatchedOrders = adminOrders.filter(o => o.status === "dispatched").length;
    const deliveredOrders = adminOrders.filter(o => o.status === "delivered").length;
    return {
      totalOrders,
      totalRevenue,
      paidOrders,
      paidRevenue,
      unpaidRevenue,
      pendingOrders,
      confirmedOrders,
      dispatchedOrders,
      deliveredOrders,
    };
  }, [adminOrders]);

  const filteredAdminOrders = useMemo(() => {
    let result = [...adminOrders];
    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase().trim();
      result = result.filter(o =>
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.customer?.name && o.customer.name.toLowerCase().includes(q)) ||
        (o.customer?.mobile && o.customer.mobile.includes(q)) ||
        (o.customer?.city && o.customer.city.toLowerCase().includes(q)) ||
        (o.customer?.state && o.customer.state.toLowerCase().includes(q)) ||
        (o.customer?.address && o.customer.address.toLowerCase().includes(q))
      );
    }
    if (adminFilter === "paid") {
      result = result.filter(o => o.paid === true || o.paymentStatus === "paid");
    } else if (adminFilter === "unpaid") {
      result = result.filter(o => !o.paid && o.paymentStatus !== "paid");
    } else if (adminFilter !== "all") {
      result = result.filter(o => o.status === adminFilter);
    }
    result.sort((a, b) => {
      const getTs = item => {
        if (item?.createdAt?.toDate) return item.createdAt.toDate().getTime();
        if (item?.createdAt?.seconds) return item.createdAt.seconds * 1000;
        if (typeof item?.createdAt === "string") return new Date(item.createdAt).getTime();
        return 0;
      };
      if (adminSort === "date_asc") return getTs(a) - getTs(b);
      if (adminSort === "total_desc") return (b.total || 0) - (a.total || 0);
      if (adminSort === "total_asc") return (a.total || 0) - (b.total || 0);
      return getTs(b) - getTs(a);
    });
    return result;
  }, [adminOrders, adminSearch, adminFilter, adminSort]);
  useEffect(() => { try { localStorage.setItem("spp-cart", JSON.stringify(cart)); } catch (e) {} }, [cart]);
  useEffect(() => {
    if (!selectedProduct) { setProductImage(null); return; }
    let active = true, objectUrl;
    if (!selectedProduct.image) { setProductImage({ status: "missing" }); return; }
    setProductImage({ status: "loading" });
    getCachedProductImage(selectedProduct.image).then(({ src, fromCache, cacheable }) => {
      objectUrl = src;
      if (active) setProductImage({ status: "loaded", src, fromCache, cacheable });
      else if (cacheable) URL.revokeObjectURL(src);
    }).catch(() => { if (active) setProductImage({ status: "error" }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [selectedProduct]);
  useEffect(() => {
    if (!selectedProduct) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = e => { if (e.key === "Escape") setSelectedProduct(null); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedProduct]);
  const setQty = (k, n) => setCart(c => { const x = { ...c }; if (n) x[k] = n; else delete x[k]; return x; });

  const lines = useMemo(() => DATA.flatMap(c => c.items.map(([n, u, p]) => {
    const k = c.id + "|" + n, qn = cart[k] || 0, o = offer(c, p);
    return { k, n, u, qn, p, o, c };
  })).filter(l => l.qn), [cart, DATA]);
  const actual = lines.reduce((s, l) => s + l.p * l.qn, 0);
  const net = lines.reduce((s, l) => s + l.o * l.qn, 0);
  const save = actual - net, count = lines.reduce((s, l) => s + l.qn, 0);
  const pack = Math.round(net * 0.03), total = net + pack;
  const min = MIN[f.state] || 1000;

  const shown = DATA.filter(c => cat === "all" || c.id === cat).map(c => ({
    ...c, items: c.items.filter(i => i[0].toLowerCase().includes(q.toLowerCase()))
  })).filter(c => c.items.length);

  const errs = {};
  if (!f.state) errs.state = "Select a state";
  if (!f.city.trim()) errs.city = "Enter your city";
  if (!f.name.trim()) errs.name = "Enter your name";
  if (!/^[6-9]\d{9}$/.test(f.mobile)) errs.mobile = "Enter a valid 10-digit mobile";
  if (!f.address.trim()) errs.address = "Enter your address";
  if (f.state && net < min) errs.min = "Minimum order for " + f.state + " is " + inr(min);
  const bad = Object.keys(errs).length > 0;
  const upd = k => e => setF({ ...f, [k]: e.target.value });
  const msg = id => "Enquiry for " + SHOP + "\nOrder ID: " + id + "\n\nName: " + f.name + "\nMobile: " + f.mobile + (f.email ? "\nEmail: " + f.email : "") + "\nCity: " + f.city + ", " + f.state + "\nAddress: " + f.address + "\n\nItems:\n" + lines.map(l => "- " + l.n + " x " + l.qn + " = " + inr(l.o * l.qn)).join("\n") + "\n\nNet Total: " + inr(net) + "\nPacking (3%): " + inr(pack) + "\nYou Save: " + inr(save) + "\nOverall: " + inr(total);
  const [sent, setSent] = useState("");
  const submit = async () => {
    setTouched(true);
    setSubmitError("");
    if (bad || savingOrder) return;
    setSavingOrder(true);
    try {
      const id = await saveOrder({
        customer: { name: f.name.trim(), mobile: f.mobile, email: f.email.trim(), city: f.city.trim(), state: f.state, address: f.address.trim() },
        items: lines.map(l => ({ name: l.n, unit: l.u, quantity: l.qn, unitPrice: l.o, total: l.o * l.qn })),
        net,
        packing: pack,
        savings: save,
        total,
      });
      setOrderId(id);
      setSent(msg(id));
      setStep("done");
      setCart({});
      try {
        setSavedPhone(f.mobile);
        setHistoryMobile(f.mobile);
      } catch {}
    } catch (error) {
      console.error("Unable to save enquiry to Firebase:", error);
      setSubmitError(error.message === "Firebase is not configured."
        ? "Firebase isn't configured yet. Add your project settings to .env and deploy firestore.rules before saving enquiries."
        : error.code === "permission-denied"
          ? "Firebase denied this order. Publish firestore.rules to the (default) database, then try again."
        : "We couldn't save your enquiry. Please check your connection and try again, or contact us by phone.");
    } finally {
      setSavingOrder(false);
    }
  };
  const lookupOrder = async event => {
    event.preventDefault();
    setLookupState({ status: "loading" });
    try {
      const found = await findOrder(lookupId);
      setLookupState(found ? { status: "found", order: found } : { status: "missing" });
    } catch (error) {
      console.error("Unable to look up order in Firebase:", error);
      setLookupState({ status: "error", message: error.message === "Firebase is not configured."
        ? "Firebase isn't configured yet. Add your project settings to .env and deploy firestore.rules to look up orders."
        : error.message === "Order ID must be a 6-digit number."
          ? error.message
        : "We couldn't retrieve that order. Please check your connection and try again." });
    }
  };
  const openOrderLookup = () => {
    setStep("lookup");
    window.scrollTo(0, 0);
  };
  const toggleOrderExpand = id => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const searchOrderHistory = async phoneToSearch => {
    const raw = phoneToSearch !== undefined ? phoneToSearch : historyMobile;
    const phone = String(raw || "").trim().replace(/\D/g, "");
    if (!phone) {
      setHistoryState({
        status: "error",
        orders: [],
        message: "Please enter your 10-digit mobile number."
      });
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setHistoryState({
        status: "error",
        orders: [],
        message: "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210)."
      });
      return;
    }
    setHistoryState({ status: "loading", orders: [] });
    try {
      const orders = await findOrdersByMobile(phone);
      try {
        setSavedPhone(phone);
      } catch {}
      if (orders.length > 0) {
        setHistoryState({ status: "found", orders });
      } else {
        setHistoryState({
          status: "empty",
          orders: [],
          searchedPhone: phone,
          message: `No past orders found for +91 ${phone}. Make sure this matches the number used when submitting your enquiry.`
        });
      }
    } catch (err) {
      console.error("Order history fetch failed:", err);
      setHistoryState({
        status: "error",
        orders: [],
        message: err.message || "Failed to load order history. Please try again."
      });
    }
  };
  const scrollToOrderHistory = prefilledPhone => {
    if (step !== "list") setStep("list");
    if (prefilledPhone) {
      setHistoryMobile(prefilledPhone);
    }
    setTimeout(() => {
      const el = document.getElementById("order-history");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        if (prefilledPhone) {
          searchOrderHistory(prefilledPhone);
        }
      }
    }, 80);
  };
  const showProductImage = (name, unit, price, emoji, imageUrl) => {
    const preferredImage = LOCAL_PRODUCT_IMAGES[name] || imageUrl;
    const image = imageUrl === undefined && !preferredImage
      ? PRODUCT_IMAGES[name]
      : preferredImage
        ? new URL(preferredImage, new URL(ASSET_BASE, window.location.href)).href
        : null;
    setSelectedProduct({ name, unit, price, emoji, image });
  };
  const Err = ({ k }) => touched && errs[k] ? <div className="err">{errs[k]}</div> : null;

  return (
    <>
      {showBrandIntro && <div className="brand-intro" role="status" aria-label="Hubballi Crackers">
        <div className="brand-intro-card">
          <span className="brand-intro-kicker">Welcome to</span>
          <span className="brand-intro-english">Hubballi Crackers</span>
          <span className="brand-intro-kannada" lang="kn">ಹುಬ್ಬಳ್ಳಿ ಕ್ರ್ಯಾಕರ್ಸ್</span>
          <span className="brand-intro-tagline">Wholesale &amp; Retail · Festive Fireworks</span>
          <button type="button" className="brand-intro-continue" onClick={() => setShowBrandIntro(false)}>Continue</button>
        </div>
      </div>}
      <div className="banner">🔥 Deepavali Special Offer · Festive Savings Up to {Math.round(DISC * 100)}% · Limited Stock 🔥</div>
      <header className={chromeHidden ? "chrome-hidden" : ""}>
        <img src={LOGO} alt="Hubballi Crackers" style={{ height: 52 }} />
        <div className="brand-wordmark"><span>Hubballi Crackers</span><span lang="kn">ಹುಬ್ಬಳ್ಳಿ ಕ್ರ್ಯಾಕರ್ಸ್</span></div>
        <nav><a href={"tel:+91" + PHONES[0]}>📞 {PHONES[0]}</a><a href="#top" onClick={() => setStep("list")}>Pricelist</a><button className="nav-action" type="button" onClick={openOrderLookup}>Find by ID</button><a href="#safety">Safety Tips</a><a href="#contact">Contact</a><a href="#admin" className="admin-nav-link" onClick={e => { e.preventDefault(); setStep("admin"); window.scrollTo(0, 0); }} aria-label="Open administrator order history and management">📜 Order History &amp; View Orders</a></nav>
      </header>

      <div className="wrap" id="top">
        {step === "list" && <>
          <div className="hero">
            <div className="mini-badge">🏮 Deepavali Collection</div>
            <h1><span className="brand-highlight"><span>Hubballi Crackers</span><span lang="kn">ಹುಬ್ಬಳ್ಳಿ ಕ್ರ್ಯಾಕರ್ಸ್</span></span><span className="hero-title-rest">Price List</span></h1>
            <p>Wholesale &amp; Retail Fancy Fireworks · Trusted festive store for families across Karnataka and South India.</p>
          </div>
          <HeroCarousel />
          {live === "loading" && <div className="empty">Loading latest rates…</div>}
          {live === "error" && <div className="err" style={{ textAlign: "center" }}>Could not load rates from Firebase. Please check your connection and try again.</div>}
          <div className="tools"><input placeholder="🔍 Search crackers…" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div className="chips">
            <button className={"chip" + (cat === "all" ? " on" : "")} onClick={() => setCat("all")}>All</button>
            {DATA.map(c => <button key={c.id} className={"chip" + (cat === c.id ? " on" : "")} onClick={() => setCat(c.id)}>{c.emoji} {c.name}</button>)}
          </div>
          {shown.length === 0 && <div className="empty">No products match “{q}”.</div>}
          {shown.map(c => (
            <section key={c.id}>
              <h2 className="cat">{c.emoji} {c.name} <small>{c.net ? "NET RATE" : c.items.some(item => item[4] != null) ? "SPECIAL OFFERS" : Math.round(DISC * 100) + "% OFF"}</small></h2>
              <div className="tbl"><table>
                <thead><tr><th></th><th>Product</th><th>Content</th><th>Actual</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead>
                <tbody>{c.items.map(([n, u, p, imageUrl, offerPrice]) => {
                  const k = c.id + "|" + n, v = cart[k] || 0, o = offer(c, p, offerPrice);
                  return <tr key={k}>
                    <td className="em">{c.emoji}</td><td><button className="product-image-trigger" type="button" onClick={() => showProductImage(n, u, o, c.emoji, imageUrl)} title={`View ${n} image`}>{n}</button></td><td>{u}</td>
                    <td className={c.net ? "" : "old"}>{c.net ? "—" : inr(p)}</td><td className="price">{inr(o)}</td>
                    <td><Qty v={v} set={n2 => setQty(k, n2)} /></td><td><b>{v ? inr(v * o) : ""}</b></td>
                  </tr>;
                })}</tbody>
              </table></div>
            </section>
          ))}

          {currentUser && isUserAdmin(currentUser) && <section className="order-history-section" id="order-history">
            <div className="order-history-header">
              <h2>📜 Order History <small style={{ fontSize: "14px", fontWeight: "normal", color: "var(--mute)" }}>(ನಿಮ್ಮ ಹಿಂದಿನ ಆರ್ಡರ್‌ಗಳು)</small></h2>
              <p>Enter your 10-digit mobile number to view all your past cracker enquiries, order statuses, and totals.</p>
            </div>

            <form className="order-history-form" onSubmit={e => { e.preventDefault(); searchOrderHistory(); }}>
              <div className="order-history-input-wrap">
                <span className="order-history-prefix">🇮🇳 +91</span>
                <input
                  className="order-history-input"
                  id="order-history-phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={historyMobile}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setHistoryMobile(val);
                    if (historyState.status !== "idle") setHistoryState({ status: "idle", orders: [] });
                  }}
                  placeholder="Enter 10-digit mobile number"
                  aria-label="10-digit mobile number for order history"
                  required
                />
              </div>
              <button className="btn" type="submit" disabled={historyState.status === "loading"}>
                {historyState.status === "loading" ? "Searching…" : "View Past Orders"}
              </button>
              {historyState.status !== "idle" && (
                <button
                  className="btn alt"
                  type="button"
                  onClick={() => {
                    setHistoryState({ status: "idle", orders: [] });
                    setHistoryMobile("");
                  }}
                >
                  Clear
                </button>
              )}
            </form>

            {savedPhone && savedPhone !== historyMobile && (
              <div className="order-history-quick-phone">
                <span>Quick fill:</span>
                <button
                  type="button"
                  className="order-history-quick-btn"
                  onClick={() => {
                    setHistoryMobile(savedPhone);
                    searchOrderHistory(savedPhone);
                  }}
                >
                  📱 Use {savedPhone}
                </button>
              </div>
            )}

            {historyState.status === "loading" && (
              <div className="empty" role="status">
                <span>⏳ Looking up past orders for +91 {historyMobile}…</span>
              </div>
            )}

            {historyState.status === "error" && (
              <div className="err" role="alert" style={{ padding: "10px 0" }}>
                ⚠️ {historyState.message}
              </div>
            )}

            {historyState.status === "empty" && (
              <div className="empty" role="status">
                <p style={{ margin: "0 0 6px", fontSize: "16px", color: "var(--ink)", fontWeight: "700" }}>
                  No orders found for +91 {historyState.searchedPhone}
                </p>
                <p style={{ margin: 0, fontSize: "13px" }}>
                  Make sure this matches the 10-digit number entered when placing your enquiry.
                </p>
              </div>
            )}

            {historyState.status === "found" && (
              <div className="order-history-results">
                <div className="order-history-stats-banner">
                  <div>
                    <span>Found <b>{historyState.orders.length}</b> {historyState.orders.length === 1 ? "enquiry" : "enquiries"} for +91 {historyMobile}</span>
                  </div>
                  <div>
                    <span>Total Value: <b>{inr(historyState.orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0))}</b></span>
                  </div>
                </div>

                <div className="order-history-cards-list">
                  {historyState.orders.map(order => {
                    const statusInfo = getStatusInfo(order.status);
                    const isExpanded = expandedOrderIds.has(order.id);
                    const itemCount = order.items?.reduce((cnt, it) => cnt + (it.quantity || 1), 0) || order.items?.length || 0;
                    const dateStr = formatOrderDate(order.createdAt);

                    return (
                      <article className="order-card" key={order.id}>
                        <div className="order-card-header">
                          <div className="order-card-id-group">
                            <span className="order-card-id">Order #{order.id}</span>
                            <span className="order-card-date">Placed: {dateStr}</span>
                          </div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                            <span className={`order-badge ${statusInfo.className}`}>
                              <span>{statusInfo.icon}</span> {statusInfo.label}
                            </span>
                            <span className={order.paid ? "admin-badge-paid" : "admin-badge-unpaid"}>
                              {order.paid ? "💳 Paid" : "⏳ Unpaid"}
                            </span>
                          </div>
                        </div>

                        <div className="order-customer-meta">
                          <b>Customer:</b> {order.customer?.name} {order.customer?.city ? `· ${order.customer.city}, ${order.customer.state || ""}` : ""}
                        </div>

                        {order.deliveryNote && (
                          <div style={{ background: "rgba(23, 96, 71, 0.08)", border: "1px solid var(--line)", padding: "6px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "12px" }}>
                            🚚 <b>Delivery Note / Tracking:</b> {order.deliveryNote}
                          </div>
                        )}

                        <div className="order-metrics-grid">
                          <div className="order-metric-box">
                            <span className="order-metric-label">Items</span>
                            <span className="order-metric-value">{itemCount} items</span>
                          </div>
                          <div className="order-metric-box">
                            <span className="order-metric-label">Net Rate</span>
                            <span className="order-metric-value">{inr(order.net || 0)}</span>
                          </div>
                          <div className="order-metric-box">
                            <span className="order-metric-label">Packing (3%)</span>
                            <span className="order-metric-value">{inr(order.packing || 0)}</span>
                          </div>
                          <div className="order-metric-box">
                            <span className="order-metric-label">You Saved</span>
                            <span className="order-metric-value savings">{inr(order.savings || 0)}</span>
                          </div>
                          <div className="order-metric-box">
                            <span className="order-metric-label">Overall Total</span>
                            <span className="order-metric-value total">{inr(order.total || 0)}</span>
                          </div>
                        </div>

                        {Array.isArray(order.items) && order.items.length > 0 && (
                          <div className="order-items-summary-chips">
                            {order.items.slice(0, 5).map((it, idx) => (
                              <span className="order-item-chip" key={idx}>
                                {it.name} <span>×{it.quantity}</span>
                              </span>
                            ))}
                            {order.items.length > 5 && (
                              <span className="order-item-chip">
                                +{order.items.length - 5} more
                              </span>
                            )}
                          </div>
                        )}

                        <div className="order-card-actions">
                          <button
                            className="btn alt"
                            type="button"
                            style={{ padding: "6px 14px", fontSize: "13px", minHeight: "36px" }}
                            onClick={() => toggleOrderExpand(order.id)}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? "Hide Details ▲" : "View Details ▼"}
                          </button>
                          <a
                            className="btn alt"
                            style={{
                              textDecoration: "none",
                              padding: "6px 14px",
                              fontSize: "13px",
                              minHeight: "36px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                            target="_blank"
                            rel="noopener"
                            href={`https://wa.me/91${PHONES[0]}?text=${encodeURIComponent(
                              `Hello Hubballi Crackers, enquiry update regarding Order ID: #${order.id} (Mobile: ${order.customer?.mobile || historyMobile}, Total: ${inr(order.total || 0)})`
                            )}`}
                          >
                            💬 WhatsApp Store
                          </a>
                        </div>

                        {isExpanded && (
                          <div className="order-details-expanded">
                            <p style={{ margin: "0 0 8px", fontSize: "13px" }}>
                              <b>Delivery Address:</b> {order.customer?.address || "Not specified"}, {order.customer?.city}, {order.customer?.state}
                            </p>
                            {order.customer?.email && (
                              <p style={{ margin: "0 0 10px", fontSize: "13px" }}>
                                <b>Email:</b> {order.customer.email}
                              </p>
                            )}
                            <table className="order-details-table">
                              <thead>
                                <tr>
                                  <th style={{ textAlign: "left" }}>Product</th>
                                  <th style={{ textAlign: "center" }}>Qty</th>
                                  <th style={{ textAlign: "right" }}>Price</th>
                                  <th style={{ textAlign: "right" }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items?.map((item, idx) => (
                                  <tr key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                                    <td>{item.name} <small style={{ color: "var(--mute)" }}>({item.unit})</small></td>
                                    <td style={{ textAlign: "center" }}>{item.quantity}</td>
                                    <td style={{ textAlign: "right" }}>{inr(item.unitPrice || 0)}</td>
                                    <td style={{ textAlign: "right", fontWeight: "700" }}>{inr(item.total || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>}
        </>}

        {step === "lookup" && <section className="order-page">
          <div className="hero"><h1>Find your order</h1><p>Enter the 6-digit Order ID from your enquiry receipt.</p></div>
          <div className="panel order-lookup" id="order-lookup">
            <form className="order-lookup-form" onSubmit={lookupOrder}>
              <label className="sr-only" htmlFor="lookup-order-id">6-digit Order ID</label>
              <input id="lookup-order-id" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={lookupId} onChange={e => { setLookupId(e.target.value.replace(/\D/g, "").slice(0, 6)); setLookupState({ status: "idle" }); }} placeholder="Enter 6-digit Order ID" required />
              <button className="btn" type="submit" disabled={lookupState.status === "loading"}>{lookupState.status === "loading" ? "Searching…" : "Find Order"}</button>
            </form>
            {lookupState.status === "missing" && <p className="err" role="status">No order was found with that ID.</p>}
            {lookupState.status === "error" && <p className="err" role="alert">{lookupState.message}</p>}
            {lookupState.status === "found" && <div className="order-details" role="status">
              <h3>Order {lookupState.order.id}</h3>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
                <span className={`order-badge ${getStatusInfo(lookupState.order.status).className}`}>
                  {getStatusInfo(lookupState.order.status).icon} {getStatusInfo(lookupState.order.status).label}
                </span>
                <span className={lookupState.order.paid ? "admin-badge-paid" : "admin-badge-unpaid"}>
                  {lookupState.order.paid ? `💳 Paid${lookupState.order.paymentMode ? ` (${lookupState.order.paymentMode})` : ""}` : "⏳ Payment Unpaid"}
                </span>
              </div>
              {lookupState.order.deliveryNote && (
                <div style={{ background: "rgba(23, 96, 71, 0.08)", border: "1px solid var(--line)", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "12px" }}>
                  🚚 <b>Delivery Note / Tracking:</b> {lookupState.order.deliveryNote}
                </div>
              )}
              <p><b>Customer:</b> {lookupState.order.customer.name} · +91 {lookupState.order.customer.mobile}</p>
              {lookupState.order.customer.email && <p><b>Email:</b> {lookupState.order.customer.email}</p>}
              <p><b>Delivery location:</b> {lookupState.order.customer.city}, {lookupState.order.customer.state} · {lookupState.order.customer.address}</p>
              {lookupState.order.items.map((item, index) => <div className="row" key={index}><span>{item.name} ({item.unit}) × {item.quantity}</span><span>{inr(item.total)}</span></div>)}
              <div className="row"><span>Net Total</span><span>{inr(lookupState.order.net)}</span></div>
              <div className="row"><span>Packing Charges</span><span>{inr(lookupState.order.packing)}</span></div>
              <div className="row"><span>You Save</span><span>{inr(lookupState.order.savings)}</span></div>
              <div className="row t"><span>Overall Amount</span><span>{inr(lookupState.order.total)}</span></div>
            </div>}
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button className="btn alt order-back" type="button" onClick={() => { setStep("list"); window.scrollTo(0, 0); }}>Back to Pricelist</button>
              <button className="btn alt order-back" type="button" onClick={() => { setStep("admin"); window.scrollTo(0, 0); }}>View All Past Orders by Phone →</button>
            </div>
          </div>
        </section>}

        {step === "form" && <>
          <div className="hero"><h1>Confirm Your Estimate</h1></div>
          <div className="panel">
            <div className="mins">{Object.entries(MIN).map(([s, a]) => <span key={s}>{s}: <b>{inr(a)}</b></span>)}</div>
            <div className="grid">
              <div><label>State *</label><select value={f.state} onChange={upd("state")}><option value="">Select State</option>{Object.keys(MIN).map(s => <option key={s}>{s}</option>)}</select><Err k="state" /></div>
              <div><label>City *</label><input value={f.city} onChange={upd("city")} placeholder="e.g. Bengaluru" /><Err k="city" /></div>
              <div><label>Name *</label><input value={f.name} onChange={upd("name")} /><Err k="name" /></div>
              <div><label>Mobile Number *</label><input inputMode="numeric" maxLength={10} value={f.mobile} onChange={e => setF({ ...f, mobile: e.target.value.replace(/\D/g, "") })} /><Err k="mobile" /></div>
              <div><label>Email</label><input type="email" value={f.email} onChange={upd("email")} /></div>
              <div><label>Address *</label><textarea rows={2} value={f.address} onChange={upd("address")} /><Err k="address" /></div>
            </div>
            {touched && errs.min && <div className="err" style={{ marginTop: 10 }}>{errs.min}</div>}
          </div>
          <div className="panel">
            {lines.map(l => <div className="row" key={l.k}><span>{l.n} × {l.qn}</span><span>{inr(l.o * l.qn)}</span></div>)}
            <div className="row t"><span>Net Total</span><span>{inr(net)}</span></div>
            <div className="row"><span>Packing Charges (3%)</span><span>{inr(pack)}</span></div>
            <div className="row" style={{ color: "var(--ok)" }}><span>You Save</span><span>{inr(save)}</span></div>
            <div className="row t"><span>Overall Amount</span><span>{inr(total)}</span></div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn alt" onClick={() => setStep("list")}>Back</button>
            <button className="btn" onClick={submit} disabled={savingOrder}>{savingOrder ? "Saving…" : "Submit Enquiry"}</button>
          </div>
          {submitError && <p className="err" role="alert" style={{ textAlign: "right" }}>{submitError}</p>}
        </>}

        {step === "done" && <div className="panel ok"><h2>✅ Enquiry saved</h2><p>Your details are saved. Send the enquiry to us and keep this Order ID to look up its details. We will confirm by WhatsApp or phone.</p>
          <p className="order-id">Order ID: <strong>{orderId}</strong></p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", margin: "14px 0" }}>
            <a className="btn" style={{ textDecoration: "none" }} target="_blank" rel="noopener" href={"mailto:" + SHOP_EMAIL + "?subject=" + encodeURIComponent("Enquiry - " + SHOP) + "&body=" + encodeURIComponent(sent)}>✉️ Send by Email</a>
            <a className="btn" style={{ textDecoration: "none" }} target="_blank" rel="noopener" href={"https://wa.me/91" + PHONES[0] + "?text=" + encodeURIComponent(sent)}>💬 Send on WhatsApp</a>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
            <button className="btn" type="button" onClick={() => scrollToOrderHistory(f.mobile || savedPhone)}>📜 View in Order History</button>
            <button className="btn alt" type="button" onClick={openOrderLookup}>🔍 Find by 6-digit ID</button>
            <button className="btn alt" type="button" onClick={() => { setStep("list"); setTouched(false); }}>Back to Pricelist</button>
          </div></div>}

        {step === "admin" && (
          <section className="admin-page">
            {authChecking && (
              <div className="admin-auth-card" role="status">
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔐</div>
                <h2>Checking Administrator Access…</h2>
                <p style={{ color: "var(--mute)" }}>Verifying Google authentication status.</p>
              </div>
            )}

            {!authChecking && !currentUser && (
              <div className="admin-auth-card" role="region" aria-label="Administrator Authentication">
                <div className="mini-badge" style={{ marginBottom: "12px" }}>🛡️ Restricted Access</div>
                <div style={{ fontSize: "42px", marginBottom: "8px" }}>🔐</div>
                <h2>Admin Portal Login</h2>
                <p style={{ color: "var(--mute)", margin: "0 0 20px", fontSize: "14px", lineHeight: "1.5" }}>
                  The store administration panel is protected. Please sign in with your authorized Google account to manage orders, mark payments, and track deliveries.
                </p>

                <div className="admin-auth-form">
                  <button
                    type="button"
                    className="google-auth-btn"
                    onClick={handleGoogleLogin}
                    disabled={signingIn}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    {signingIn ? "Signing in with Google…" : "Sign in with Google"}
                  </button>

                  {authError && (
                    <div className="err" style={{ fontSize: "13px", marginTop: "10px", textAlign: "center" }} role="alert">
                      ⚠️ {authError}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn alt"
                    style={{ marginTop: "12px", fontSize: "13px" }}
                    onClick={() => { setStep("list"); window.scrollTo(0, 0); }}
                  >
                    ← Back to Storefront
                  </button>
                </div>
              </div>
            )}

            {!authChecking && currentUser && !isUserAdmin(currentUser) && (
              <div className="admin-auth-card" role="region" aria-label="Access Denied">
                <div style={{ fontSize: "42px", marginBottom: "8px" }}>🚫</div>
                <h2>Access Denied</h2>
                <p style={{ color: "var(--brand)", fontWeight: "700", marginBottom: "8px" }}>
                  Unauthorized Account
                </p>
                <p style={{ color: "var(--mute)", fontSize: "14px", marginBottom: "20px", lineHeight: "1.5" }}>
                  This Google account does not have administrator privileges for Hubballi Crackers. Admin access is reserved for the authorized store administrator.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
                  <button
                    type="button"
                    className="google-auth-btn"
                    onClick={handleGoogleLogin}
                    disabled={signingIn}
                  >
                    🔄 Switch to Authorized Google Account
                  </button>
                  <button
                    type="button"
                    className="btn alt"
                    onClick={handleAdminLogout}
                  >
                    🚪 Sign Out
                  </button>
                  <button
                    type="button"
                    className="btn alt"
                    style={{ fontSize: "13px" }}
                    onClick={() => { setStep("list"); window.scrollTo(0, 0); }}
                  >
                    ← Back to Storefront
                  </button>
                </div>
              </div>
            )}

            {!authChecking && currentUser && isUserAdmin(currentUser) && (
              <>
                <div className="admin-header-row">
                  <div className="admin-header-titles">
                    <div className="mini-badge">🛡️ Store Administration</div>
                    <h1>Order History &amp; Management</h1>
                    <p>View order history, verify customer details, mark payments, and track delivery stages.</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <div className="admin-user-pill">
                      {currentUser.photoURL && (
                        <img src={currentUser.photoURL} alt="" className="admin-user-avatar" />
                      )}
                      <span><b>Admin:</b> {currentUser.displayName || "Store Owner"}</span>
                    </div>
                    <button
                      className="btn alt"
                      type="button"
                      onClick={handleAdminLogout}
                      title="Sign out of Admin Portal"
                    >
                      🚪 Sign Out
                    </button>
                    <button
                      className="btn alt"
                      type="button"
                      onClick={() => { setStep("list"); window.scrollTo(0, 0); }}
                    >
                      🛒 Store
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={loadAdminOrders}
                      disabled={adminLoading}
                    >
                      {adminLoading ? "Refreshing…" : "🔄 Refresh Orders"}
                    </button>
                    {adminOrders.length === 0 && !adminLoading && (
                      <button
                        className="btn alt"
                        type="button"
                        onClick={handleCreateDemoOrder}
                        disabled={actionLoadingId === "demo"}
                      >
                        {actionLoadingId === "demo" ? "Creating…" : "➕ Create Demo Order"}
                      </button>
                    )}
                  </div>
                </div>

            {actionToast && (
              <div className={`admin-toast ${actionToast.type}`} role="status">
                <span>{actionToast.type === "success" ? "✅" : "⚠️"} {actionToast.text}</span>
                <button
                  type="button"
                  style={{ background: "none", border: 0, font: "inherit", cursor: "pointer", fontWeight: "bold" }}
                  onClick={() => setActionToast(null)}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <div className="admin-stat-label">Total Orders</div>
                <div className="admin-stat-val">{adminStats.totalOrders}</div>
                <div className="admin-stat-sub">Revenue: <b>{inr(adminStats.totalRevenue)}</b></div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-label">Paid Orders</div>
                <div className="admin-stat-val" style={{ color: "var(--ok)" }}>{adminStats.paidOrders}</div>
                <div className="admin-stat-sub">Collected: <b>{inr(adminStats.paidRevenue)}</b></div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-label">Pending Payment</div>
                <div className="admin-stat-val" style={{ color: "var(--brand)" }}>{adminStats.totalOrders - adminStats.paidOrders}</div>
                <div className="admin-stat-sub">Unpaid: <b>{inr(adminStats.unpaidRevenue)}</b></div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-label">Delivery Pipeline</div>
                <div className="admin-stat-val" style={{ fontSize: "15px", marginTop: "4px" }}>
                  <span>⏳ {adminStats.pendingOrders}</span> · <span>✅ {adminStats.confirmedOrders}</span> · <span>🚚 {adminStats.dispatchedOrders}</span> · <span>🎉 {adminStats.deliveredOrders}</span>
                </div>
                <div className="admin-stat-sub">
                  {adminStats.deliveredOrders} of {adminStats.totalOrders} delivered
                </div>
              </div>
            </div>

            <div className="admin-filters-bar">
              <input
                placeholder="🔍 Search orders by ID, name, phone, city, address…"
                value={adminSearch}
                onChange={e => setAdminSearch(e.target.value)}
              />
              <select value={adminFilter} onChange={e => setAdminFilter(e.target.value)}>
                <option value="all">All Orders ({adminOrders.length})</option>
                <option value="pending_confirmation">⏳ Pending Confirmation ({adminStats.pendingOrders})</option>
                <option value="confirmed">✅ Confirmed ({adminStats.confirmedOrders})</option>
                <option value="dispatched">🚚 Dispatched ({adminStats.dispatchedOrders})</option>
                <option value="delivered">🎉 Delivered / Successful ({adminStats.deliveredOrders})</option>
                <option value="paid">💳 Paid ({adminStats.paidOrders})</option>
                <option value="unpaid">⚠️ Unpaid ({adminStats.totalOrders - adminStats.paidOrders})</option>
              </select>
              <select value={adminSort} onChange={e => setAdminSort(e.target.value)}>
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="total_desc">Total: High to Low</option>
                <option value="total_asc">Total: Low to High</option>
              </select>
            </div>

            {adminLoading && (
              <div className="empty" role="status">
                <span>⏳ Loading all orders from store database…</span>
              </div>
            )}

            {adminError && (
              <div className="err" role="alert" style={{ marginBottom: "20px" }}>
                ⚠️ {adminError}
              </div>
            )}

            {!adminLoading && filteredAdminOrders.length === 0 && (
              <div className="empty" role="status">
                <p style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700", color: "var(--ink)" }}>
                  {adminOrders.length === 0 ? "No orders found in the database yet." : "No orders match your filter criteria."}
                </p>
                <p style={{ margin: "0 0 16px", fontSize: "13px" }}>
                  {adminOrders.length === 0
                    ? "Orders submitted through the storefront will appear here automatically."
                    : "Try clearing your search query or switching the status filter."}
                </p>
                {adminOrders.length === 0 ? (
                  <button className="btn" type="button" onClick={handleCreateDemoOrder}>
                    ➕ Create Sample Demo Order to Test
                  </button>
                ) : (
                  <button className="btn alt" type="button" onClick={() => { setAdminSearch(""); setAdminFilter("all"); }}>
                    Reset Filters
                  </button>
                )}
              </div>
            )}

            {!adminLoading && filteredAdminOrders.length > 0 && (
              <div className="admin-orders-list">
                {filteredAdminOrders.map(order => {
                  const statusInfo = getStatusInfo(order.status);
                  const isExpanded = adminExpandedIds.has(order.id);
                  const isDelivered = order.status === "delivered";
                  const isPaid = order.paid === true || order.paymentStatus === "paid";
                  const dateStr = formatOrderDate(order.createdAt);
                  const isActionLoading = actionLoadingId === order.id;
                  const currentMode = paymentModes[order.id] || order.paymentMode || "UPI / GPay / PhonePe";
                  const isEditingTracking = editingTrackingId === order.id;

                  const stages = [
                    { id: "pending_confirmation", label: "Pending", icon: "⏳" },
                    { id: "confirmed", label: "Confirmed", icon: "✅" },
                    { id: "dispatched", label: "Dispatched", icon: "🚚" },
                    { id: "delivered", label: "Delivered", icon: "🎉" }
                  ];

                  const getStageIndex = (st) => {
                    if (st === "confirmed") return 1;
                    if (st === "dispatched") return 2;
                    if (st === "delivered") return 3;
                    return 0;
                  };

                  const currentStageIdx = getStageIndex(order.status);

                  return (
                    <article className="admin-order-card" key={order.id}>
                      <div className="admin-card-header">
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "18px", fontWeight: "900", color: "var(--leaf-dark)", letterSpacing: "0.5px" }}>
                              Order #{order.id}
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--mute)" }}>
                              Placed: {dateStr}
                            </span>
                          </div>
                        </div>

                        <div className="admin-badges-wrap">
                          <span className={isPaid ? "admin-badge-paid" : "admin-badge-unpaid"}>
                            {isPaid ? `💳 Paid${order.paymentMode ? ` (${order.paymentMode})` : ""}` : "⏳ Payment Unpaid"}
                          </span>
                          <span className={`order-badge ${statusInfo.className}`}>
                            <span>{statusInfo.icon}</span> {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Delivery Stepper Tracker */}
                      <div className="admin-stepper">
                        <span style={{ fontWeight: "700", color: "var(--mute)", marginRight: "4px" }}>Delivery Stage:</span>
                        {stages.map((st, idx) => {
                          const isActive = idx <= currentStageIdx && order.status !== "cancelled";
                          return (
                            <span key={st.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <button
                                type="button"
                                className={`admin-step-pill ${isActive ? "active" : ""}`}
                                onClick={() => handleUpdateStatus(order, st.id)}
                                title={`Set status to ${st.label}`}
                                disabled={isActionLoading}
                              >
                                {st.icon} {st.label}
                              </button>
                              {idx < stages.length - 1 && <span className="admin-step-arrow">→</span>}
                            </span>
                          );
                        })}
                        {order.status === "cancelled" && (
                          <span className="order-badge order-badge-cancelled" style={{ marginLeft: "4px" }}>
                            ❌ Cancelled
                          </span>
                        )}
                      </div>

                      <div className="admin-order-grid-info">
                        <div className="admin-customer-box">
                          <div className="admin-box-title">👤 Customer Details</div>
                          <div><b>Name:</b> {order.customer?.name}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                            <span><b>Phone:</b> +91 {order.customer?.mobile}</span>
                            <a
                              href={`tel:+91${order.customer?.mobile}`}
                              style={{ textDecoration: "none", color: "var(--leaf-dark)", fontWeight: "700", fontSize: "12px" }}
                            >
                              📞 Call
                            </a>
                            <a
                              href={`https://wa.me/91${order.customer?.mobile}?text=${encodeURIComponent(
                                `Hello ${order.customer?.name || "Customer"}, this is Hubballi Crackers regarding your Order #${order.id}. Total Amount: ${inr(order.total || 0)}. Payment Status: ${isPaid ? "PAID" : "UNPAID"}. Delivery Status: ${statusInfo.label}.`
                              )}`}
                              target="_blank"
                              rel="noopener"
                              style={{ textDecoration: "none", color: "var(--ok)", fontWeight: "700", fontSize: "12px" }}
                            >
                              💬 WhatsApp
                            </a>
                          </div>
                          {order.customer?.email && <div><b>Email:</b> {order.customer.email}</div>}
                        </div>

                        <div className="admin-shipping-box">
                          <div className="admin-box-title">📍 Delivery &amp; Shipping</div>
                          <div><b>Location:</b> {order.customer?.city}, {order.customer?.state}</div>
                          <div><b>Address:</b> {order.customer?.address}</div>
                          {order.deliveryNote && (
                            <div style={{ marginTop: "6px", background: "rgba(23, 96, 71, 0.08)", padding: "4px 8px", borderRadius: "6px" }}>
                              🚚 <b>Tracking Note:</b> {order.deliveryNote}
                            </div>
                          )}
                        </div>

                        <div className="admin-shipping-box">
                          <div className="admin-box-title">💰 Financials &amp; Items</div>
                          <div><b>Items Count:</b> {order.items?.length || 0} cracker products</div>
                          <div><b>Net Rate:</b> {inr(order.net || 0)} · <b>Packing (3%):</b> {inr(order.packing || 0)}</div>
                          <div><b>Discount Saved:</b> <span style={{ color: "var(--ok)", fontWeight: "700" }}>{inr(order.savings || 0)}</span></div>
                          <div style={{ fontSize: "15px", marginTop: "4px" }}><b>Overall Total:</b> <span style={{ color: "var(--brand)", fontWeight: "900" }}>{inr(order.total || 0)}</span></div>
                        </div>
                      </div>

                      {/* Primary Action Controls */}
                      <div className="admin-actions-bar">
                        <div className="admin-action-buttons">
                          {/* Payment Toggle */}
                          {isPaid ? (
                            <button
                              className="btn alt"
                              type="button"
                              onClick={() => handleMarkPaid(order, false)}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? "Saving…" : "↩️ Mark as Unpaid"}
                            </button>
                          ) : (
                            <div style={{ display: "inline-flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                              <select
                                style={{ width: "auto", padding: "6px 10px", fontSize: "12px", height: "36px" }}
                                value={currentMode}
                                onChange={e => setPaymentModes({ ...paymentModes, [order.id]: e.target.value })}
                              >
                                <option value="UPI / GPay / PhonePe">UPI (GPay/PhonePe)</option>
                                <option value="Cash on Delivery">Cash on Delivery</option>
                                <option value="Bank Transfer (NEFT/IMPS)">Bank Transfer</option>
                                <option value="Card">Card</option>
                              </select>
                              <button
                                className="btn"
                                type="button"
                                style={{ background: "var(--ok)", borderColor: "var(--ok)", padding: "6px 14px", height: "36px" }}
                                onClick={() => handleMarkPaid(order, true)}
                                disabled={isActionLoading}
                              >
                                {isActionLoading ? "Saving…" : "💳 Mark as Paid"}
                              </button>
                            </div>
                          )}

                          {/* Delivery Successful Action */}
                          <button
                            className="btn"
                            type="button"
                            style={{
                              background: isDelivered ? "#2e7d32" : "#1b5e20",
                              borderColor: "#1b5e20",
                              padding: "6px 14px",
                              height: "36px"
                            }}
                            onClick={() => handleMarkDeliverySuccessful(order)}
                            disabled={isActionLoading || isDelivered}
                          >
                            {isDelivered ? "✅ Delivery Successful" : "🎉 Mark Delivery Successful"}
                          </button>

                          {/* Status Dropdown Selector */}
                          <select
                            style={{ width: "auto", padding: "6px 10px", fontSize: "12px", height: "36px" }}
                            value={order.status || "pending_confirmation"}
                            onChange={e => handleUpdateStatus(order, e.target.value)}
                            disabled={isActionLoading}
                          >
                            <option value="pending_confirmation">⏳ Set: Pending Confirmation</option>
                            <option value="confirmed">✅ Set: Confirmed</option>
                            <option value="dispatched">🚚 Set: Dispatched</option>
                            <option value="delivered">🎉 Set: Delivery Successful</option>
                            <option value="cancelled">❌ Set: Cancelled</option>
                          </select>

                          {/* Tracking note toggle */}
                          <button
                            className="btn alt"
                            type="button"
                            style={{ padding: "6px 12px", height: "36px", fontSize: "12px" }}
                            onClick={() => {
                              setEditingTrackingId(isEditingTracking ? null : order.id);
                              if (!trackingNotes[order.id]) {
                                setTrackingNotes({ ...trackingNotes, [order.id]: order.deliveryNote || "" });
                              }
                            }}
                          >
                            {order.deliveryNote ? "✏️ Edit Tracking" : "📝 Add Tracking"}
                          </button>
                        </div>

                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <button
                            className="btn alt"
                            type="button"
                            style={{ padding: "6px 12px", height: "36px", fontSize: "12px" }}
                            onClick={() => toggleAdminExpand(order.id)}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? "Hide Products ▲" : "View Products ▼"}
                          </button>
                        </div>
                      </div>

                      {/* Tracking / Delivery Note Editor */}
                      {isEditingTracking && (
                        <div className="admin-tracking-editor">
                          <div style={{ fontWeight: "700", fontSize: "13px", marginBottom: "6px" }}>
                            🚚 Update Delivery Tracking &amp; Courier Note for Order #{order.id}:
                          </div>
                          <div className="admin-tracking-editor-grid">
                            <input
                              placeholder="e.g. Dispatched via VRL Logistics, LR #581902, Contact: 9845012345"
                              value={trackingNotes[order.id] !== undefined ? trackingNotes[order.id] : (order.deliveryNote || "")}
                              onChange={e => setTrackingNotes({ ...trackingNotes, [order.id]: e.target.value })}
                            />
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                className="btn"
                                type="button"
                                style={{ padding: "8px 14px", fontSize: "12px" }}
                                onClick={() => handleUpdateStatus(order, order.status || "dispatched", trackingNotes[order.id])}
                                disabled={isActionLoading}
                              >
                                Save Tracking
                              </button>
                              <button
                                className="btn alt"
                                type="button"
                                style={{ padding: "8px 14px", fontSize: "12px" }}
                                onClick={() => setEditingTrackingId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expandable Order Items Breakdown */}
                      {isExpanded && (
                        <div className="order-details-expanded">
                          <table className="order-details-table">
                            <thead>
                              <tr>
                                <th style={{ textAlign: "left" }}>Cracker Product</th>
                                <th style={{ textAlign: "center" }}>Unit</th>
                                <th style={{ textAlign: "center" }}>Qty</th>
                                <th style={{ textAlign: "right" }}>Unit Price</th>
                                <th style={{ textAlign: "right" }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items?.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                                  <td>{item.name}</td>
                                  <td style={{ textAlign: "center", color: "var(--mute)" }}>{item.unit}</td>
                                  <td style={{ textAlign: "center", fontWeight: "700" }}>{item.quantity}</td>
                                  <td style={{ textAlign: "right" }}>{inr(item.unitPrice || 0)}</td>
                                  <td style={{ textAlign: "right", fontWeight: "700" }}>{inr(item.total || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
              </>
            )}
          </section>
        )}

        <div className="panel tips" id="safety">
          <h3 style={{ marginTop: 0 }}>🧯 Safety Tips</h3>
          <ul><li>Use crackers outdoors in an open area, away from buildings and dry grass.</li><li>Keep a bucket of water or sand nearby. Light one at a time with a long incense stick.</li><li>Children must be supervised by an adult. Never relight a dud — douse it with water.</li><li>Wear cotton clothes and keep pets and elders at a safe distance.</li></ul>
        </div>
      </div>

      {step === "list" && <div className={"bar" + (chromeHidden ? " chrome-hidden" : "")}>
        <div><span>Items</span><b>{count}</b></div>
        <div><span>Net Total</span><b>{inr(net)}</b></div>
        <div><span>You Save</span><b style={{ color: "var(--ok)" }}>{inr(save)}</b></div>
        <div><span>Overall</span><b>{inr(actual ? total : 0)}</b></div>
        <button className="btn" disabled={!count} onClick={() => { setStep("form"); window.scrollTo(0, 0); }}>Confirm Estimate →</button>
      </div>}

      <footer id="contact"><div className="wrap grid">
        <div><img src={LOGO} alt="" style={{ height: 60, display: "block", marginBottom: 6 }} /><h4>About</h4><b>Hubballi Crackers · ಹುಬ್ಬಳ್ಳಿ ಕ್ರ್ಯಾಕರ್ಸ್</b> — Wholesale &amp; Retail Fancy Fireworks. All kinds of crackers available. Genuine products, best quality, trusted dealer.</div>
        <div><h4>Contact</h4>📍 Tadas Cross, Near Gayatri Matt, Ramankoppa/Tadas Cross 581116<br />📍 Stall No. 6, APMC Ground, Shiggaon<br />{PHONES.map(p => <div key={p}>📞 <a style={{ color: "inherit" }} href={"tel:+91" + p}>{p}</a></div>)}</div>
        <div><h4>Notice</h4>Online sale of firecrackers is not permitted (Supreme Court, 2018). Add products to the cart and submit an enquiry; we confirm the order offline.</div>
      </div></footer>

      {selectedProduct && <div className="product-image-backdrop" onClick={() => setSelectedProduct(null)}>
        <section className="product-image-dialog" role="dialog" aria-modal="true" aria-labelledby="product-image-title" onClick={e => e.stopPropagation()}>
          <button className="product-image-close" type="button" aria-label="Close product image" onClick={() => setSelectedProduct(null)}>×</button>
          <div className="product-image-heading">
            <span>{selectedProduct.emoji} Product photo</span>
            <h2 id="product-image-title">{selectedProduct.name}</h2>
            <p>{selectedProduct.unit} · {inr(selectedProduct.price)}</p>
          </div>
          <div className="product-image-frame">
            {productImage?.status === "loading" && <p>Loading photo and saving it to this browser…</p>}
            {productImage?.status === "loaded" && <img src={productImage.src} alt={selectedProduct.name} />}
            {productImage?.status === "missing" && <div className="product-image-message"><span>{selectedProduct.emoji}</span><p>This product has no photo URL in the product catalog.</p></div>}
            {productImage?.status === "error" && <div className="product-image-message"><span>{selectedProduct.emoji}</span><p>The photo could not be loaded. Please try again while online.</p></div>}
          </div>
          <div className="product-image-footer">
            <span>{productImage?.status === "loaded" ? "Loaded freshly from the product image server." : "Product images are fetched fresh when opened."}</span>
            <span>Product image</span>
          </div>
        </section>
      </div>}
    </>
  );
}

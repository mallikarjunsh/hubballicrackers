import { useState, useMemo, useEffect } from "react";
import { loadRates } from "./firebase";
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
const PRODUCT_IMAGE_CACHE = "hubballi-crackers-product-images-v1";
const pendingProductImages = new Map();
const getCachedProductImage = source => {
  let pending = pendingProductImages.get(source);
  if (!pending) {
    pending = (async () => {
      const cache = "caches" in window ? await caches.open(PRODUCT_IMAGE_CACHE) : null;
      let response = cache ? await cache.match(source) : null;
      const fromCache = !!response;
      if (!response) {
        response = await fetch(source, { mode: "cors" });
        if (!response.ok) throw new Error("Image request failed");
        if (cache) {
          try { await cache.put(source, response.clone()); } catch (e) {}
        }
      }
      return { blob: await response.blob(), fromCache };
    })().finally(() => pendingProductImages.delete(source));
    pendingProductImages.set(source, pending);
  }
  return pending.then(({ blob, fromCache }) => ({ src: URL.createObjectURL(blob), fromCache }));
};
let MIN = { "Karnataka": 1000, "Maharashtra": 3000, "Goa": 3000 };
// [name, unit, printed price]
const FALLBACK_DATA = [
  { id: "combo", name: "Premium Combo Packs", emoji: "🎁", net: true, items: [["Combo Pack - Starter", "1 Box", 3000], ["Combo Pack - Hero", "1 Box", 5000], ["Combo Pack - Legend", "4 Box", 10000]] },
  { id: "sound", name: "One Sound Crackers", emoji: "💥", items: [["2⅞' Kuruvi", "1 Pkt", 35], ["3½' Lakshmi", "1 Pkt", 70], ["4' Deluxe Lakshmi", "1 Pkt", 175], ["Red Bijili (100 Pcs)", "1 Pkt", 185]] },
  { id: "spark", name: "Sparklers", emoji: "✨", items: [["12 Cm Electric Sparklers", "1 Box", 210], ["12 Cm Colour Sparklers", "1 Box", 220], ["15 Cm Green Sparklers", "2 Box", 720], ["30 Cm Red Sparklers", "2 Box", 740]] },
  { id: "chakkar", name: "Ground Chakkar & Flower Pots", emoji: "🌀", items: [["Ground Chakkar Big (25 Pcs)", "1 Box", 400], ["Ground Chakkar Deluxe (10 Pcs)", "1 Box", 700], ["Flower Pots Special (10 Pcs)", "1 Box", 500], ["Flower Pots Deluxe (5 Pcs)", "1 Box", 1250]] },
  { id: "kids", name: "Kids Attractions", emoji: "🧒", items: [["Butterfly (18 Pcs)", "1 Box", 500], ["Helicopter (5 Pcs)", "1 Box", 650], ["Photo Flash Sticks (5 Pcs)", "1 Box", 800], ["Mega Siren", "1 Box", 1000]] },
  { id: "fount", name: "Fancy Fountains", emoji: "⛲", items: [["Golden Elephant", "1 Pce", 1500], ["Lucky Lion", "1 Pce", 2000], ["Strawberry Cone Fountain", "1 Pce", 1200], ["Tricolour Fountains (5 Pcs)", "1 Box", 1500]] },
  { id: "rocket", name: "Rockets & Bombs", emoji: "🚀", items: [["Musical Rocket", "1 Box", 1000], ["Two Sound Rocket", "1 Box", 1000], ["Hydro Bomb (10 Pcs)", "1 Box", 450], ["1/2 kg Paper Bomb", "1 Pce", 500]] },
  { id: "night", name: "Multicolour Night Shots", emoji: "🎆", items: [["7 Shots Multicolour", "1 Box", 600], ["12 Shots Crackling", "1 Box", 650], ["30 Shots Multicolour", "1 Box", 2400], ["60 Shots Multicolour", "1 Box", 4800], ["120 Shots Multicolour", "1 Box", 9600]] },
  { id: "garland", name: "Festival Garlands", emoji: "🎊", items: [["100 Wala", "1 Box", 180], ["1000 Wala (Short)", "1 Box", 850], ["2000 Wala (Premium)", "1 Box", 3500], ["5000 Wala (Premium)", "1 Box", 8750]] },
  { id: "gift", name: "Gift Boxes", emoji: "🧧", items: [["20 Item Gift Box", "1 Box", 1750], ["30 Item Gift Box", "1 Box", 3000], ["50 Item Gift Box", "1 Box", 5500]] },
];
const offer = (cat, p) => (cat.net ? p : Math.round(p * (1 - DISC)));
const inr = n => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const load = () => { try { return JSON.parse(localStorage.getItem("spp-cart") || "{}"); } catch (e) { return {}; } };

function Qty({ v, set }) {
  return (
    <div className="qty">
      <button aria-label="decrease" onClick={() => set(Math.max(0, v - 1))}>−</button>
      <input inputMode="numeric" value={v || ""} placeholder="0" onChange={e => set(Math.max(0, parseInt(e.target.value.replace(/\D/g, "")) || 0))} />
      <button aria-label="increase" onClick={() => set(v + 1)}>+</button>
    </div>
  );
}

function HeroCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
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
              <span>Hubballi Crackers</span>
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
  const [DATA, setData] = useState(FALLBACK_DATA);
  const [live, setLive] = useState("loading");
  useEffect(() => { loadRates().then(r => { if (r) { if (typeof r.discount === "number") DISC = r.discount; if (r.minOrder) MIN = r.minOrder; setData(r.cats); setLive("live"); } else setLive("offline"); }).catch(() => setLive("offline")); }, []);
  const [cart, setCart] = useState(load);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [step, setStep] = useState("list");
  const [f, setF] = useState({ state: "", city: "", name: "", mobile: "", email: "", address: "" });
  const [touched, setTouched] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productImage, setProductImage] = useState(null);
  useEffect(() => { try { localStorage.setItem("spp-cart", JSON.stringify(cart)); } catch (e) {} }, [cart]);
  useEffect(() => {
    if (!selectedProduct) { setProductImage(null); return; }
    let active = true, objectUrl;
    if (!selectedProduct.image) { setProductImage({ status: "missing" }); return; }
    setProductImage({ status: "loading" });
    getCachedProductImage(selectedProduct.image).then(({ src, fromCache }) => {
      objectUrl = src;
      if (active) setProductImage({ status: "loaded", src, fromCache });
      else URL.revokeObjectURL(src);
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
    return { k, n, qn, p, o, c };
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
  const msg = () => "Enquiry for " + SHOP + "\n\nName: " + f.name + "\nMobile: " + f.mobile + (f.email ? "\nEmail: " + f.email : "") + "\nCity: " + f.city + ", " + f.state + "\nAddress: " + f.address + "\n\nItems:\n" + lines.map(l => "- " + l.n + " x " + l.qn + " = " + inr(l.o * l.qn)).join("\n") + "\n\nNet Total: " + inr(net) + "\nPacking (3%): " + inr(pack) + "\nYou Save: " + inr(save) + "\nOverall: " + inr(total);
  const [sent, setSent] = useState("");
  const submit = () => { setTouched(true); if (!bad) { setSent(msg()); setStep("done"); setCart({}); } };
  const showProductImage = (name, unit, price, emoji) => setSelectedProduct({ name, unit, price, emoji, image: PRODUCT_IMAGES[name] });
  const Err = ({ k }) => touched && errs[k] ? <div className="err">{errs[k]}</div> : null;

  return (
    <>
      <div className="banner">🔥 Deepavali Special Offer · Festive Savings Up to {Math.round(DISC * 100)}% · Limited Stock 🔥</div>
      <header>
        <img src={LOGO} alt="Hubballi Crackers" style={{ height: 52 }} />
        <nav><a href={"tel:+91" + PHONES[0]}>📞 {PHONES[0]}</a><a href="#top" onClick={() => setStep("list")}>Pricelist</a><a href="#safety">Safety Tips</a><a href="#contact">Contact</a></nav>
      </header>

      <div className="wrap" id="top">
        {step === "list" && <>
          <div className="hero">
            <div className="mini-badge">🏮 Deepavali Collection</div>
            <h1>ಹುಬ್ಬಳ್ಳಿ ಕ್ರ್ಯಾಕರ್ಸ್ · Price List</h1>
            <p>Wholesale &amp; Retail Fancy Fireworks · Trusted festive store for families across Karnataka and South India.</p>
          </div>
          <HeroCarousel />
          {live === "loading" && <div className="empty">Loading latest rates…</div>}
          {live === "offline" && <div className="err" style={{ textAlign: "center" }}>Showing saved rates (could not reach live rate list).</div>}
          <div className="tools"><input placeholder="🔍 Search crackers…" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div className="chips">
            <button className={"chip" + (cat === "all" ? " on" : "")} onClick={() => setCat("all")}>All</button>
            {DATA.map(c => <button key={c.id} className={"chip" + (cat === c.id ? " on" : "")} onClick={() => setCat(c.id)}>{c.emoji} {c.name}</button>)}
          </div>
          {shown.length === 0 && <div className="empty">No products match “{q}”.</div>}
          {shown.map(c => (
            <section key={c.id}>
              <h2 className="cat">{c.emoji} {c.name} <small>{c.net ? "NET RATE" : Math.round(DISC * 100) + "% OFF"}</small></h2>
              <div className="tbl"><table>
                <thead><tr><th></th><th>Product</th><th>Content</th><th>Actual</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead>
                <tbody>{c.items.map(([n, u, p]) => {
                  const k = c.id + "|" + n, v = cart[k] || 0, o = offer(c, p);
                  return <tr key={k}>
                    <td className="em">{c.emoji}</td><td><button className="product-image-trigger" type="button" onClick={() => showProductImage(n, u, o, c.emoji)} title={`View ${n} image`}>{n}</button></td><td>{u}</td>
                    <td className={c.net ? "" : "old"}>{c.net ? "—" : inr(p)}</td><td className="price">{inr(o)}</td>
                    <td><Qty v={v} set={n2 => setQty(k, n2)} /></td><td><b>{v ? inr(v * o) : ""}</b></td>
                  </tr>;
                })}</tbody>
              </table></div>
            </section>
          ))}
        </>}

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
            <button className="btn" onClick={submit}>Submit Enquiry</button>
          </div>
        </>}

        {step === "done" && <div className="panel ok"><h2>✅ Enquiry received</h2><p>Your enquiry is ready. Send it now so we receive it — we will confirm by WhatsApp or phone.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", margin: "14px 0" }}>
            <a className="btn" style={{ textDecoration: "none" }} target="_blank" rel="noopener" href={"mailto:" + SHOP_EMAIL + "?subject=" + encodeURIComponent("Enquiry - " + SHOP) + "&body=" + encodeURIComponent(sent)}>✉️ Send by Email</a>
            <a className="btn" style={{ textDecoration: "none", background: "#1a8a4a" }} target="_blank" rel="noopener" href={"https://wa.me/91" + PHONES[0] + "?text=" + encodeURIComponent(sent)}>💬 Send on WhatsApp</a>
          </div>
          <button className="btn alt" onClick={() => { setStep("list"); setTouched(false); }}>Back to Pricelist</button></div>}

        <div className="panel tips" id="safety">
          <h3 style={{ marginTop: 0 }}>🧯 Safety Tips</h3>
          <ul><li>Use crackers outdoors in an open area, away from buildings and dry grass.</li><li>Keep a bucket of water or sand nearby. Light one at a time with a long incense stick.</li><li>Children must be supervised by an adult. Never relight a dud — douse it with water.</li><li>Wear cotton clothes and keep pets and elders at a safe distance.</li></ul>
        </div>
      </div>

      {step === "list" && <div className="bar">
        <div><span>Items</span><b>{count}</b></div>
        <div><span>Net Total</span><b>{inr(net)}</b></div>
        <div><span>You Save</span><b style={{ color: "var(--ok)" }}>{inr(save)}</b></div>
        <div><span>Overall</span><b>{inr(actual ? total : 0)}</b></div>
        <button className="btn" disabled={!count} onClick={() => { setStep("form"); window.scrollTo(0, 0); }}>Confirm Estimate →</button>
      </div>}

      <footer id="contact"><div className="wrap grid">
        <div><img src={LOGO} alt="" style={{ height: 60, display: "block", marginBottom: 6 }} /><h4>About</h4>Hubballi Crackers — Wholesale &amp; Retail Fancy Fireworks. All kinds of crackers available. Genuine products, best quality, trusted dealer.</div>
        <div><h4>Contact</h4>📍 Tadas Cross, Near Gayatri Matt, Shiggaon 581116<br />{PHONES.map(p => <div key={p}>📞 <a style={{ color: "inherit" }} href={"tel:+91" + p}>{p}</a></div>)}</div>
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
            {productImage?.status === "missing" && <div className="product-image-message"><span>{selectedProduct.emoji}</span><p>This product has no photo in the supplied catalog.</p></div>}
            {productImage?.status === "error" && <div className="product-image-message"><span>{selectedProduct.emoji}</span><p>The photo could not be loaded. Please try again while online.</p></div>}
          </div>
          <div className="product-image-footer">
            <span>{productImage?.status === "loaded" ? (productImage.fromCache ? "Loaded from this browser’s saved image cache." : "Saved in this browser for next time.") : "Images are cached in this browser after their first successful load."}</span>
            <a href="https://mtpcrackers.in/products.php?device=desktop" target="_blank" rel="noopener noreferrer">Photo source: MTP Crackers</a>
          </div>
        </section>
      </div>}
    </>
  );
}

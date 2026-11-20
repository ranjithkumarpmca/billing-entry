import { useEffect, useState } from "react";

// Full-page backdrop: fixed behind everything, the page content sits on top of it.
// A stylised corridor (Chennai to Thoothukudi), not a map.
const CITIES = [
  { x: 110, y: 470, name: "CHENNAI" },
  { x: 380, y: 400, name: "TIRUCHIRAPPALLI" },
  { x: 640, y: 450, name: "MADURAI" },
  { x: 900, y: 370, name: "COIMBATORE" },
  { x: 1075, y: 440, name: "THOOTHUKUDI" },
];
const ROUTE = "M110 470 C 230 380, 300 470, 380 400 S 560 480, 640 450 S 800 330, 900 370 S 1030 460, 1075 440";
const STARS = [[60,60],[190,120],[330,50],[470,110],[610,40],[760,90],[880,50],[1010,110],[1130,60],[260,190],[540,180],[980,170],[1150,160],[430,30]];

// Sky follows the device clock (no internet needed). Add ?sky=morning|day|evening|night to the address to preview one.
const SKY_HOURS = { morning: 8, day: 13, evening: 17.5, night: 22 };
function skyOf(h) {
  if (h >= 5 && h < 10) return "morning";
  if (h >= 10 && h < 16) return "day";
  if (h >= 16 && h < 19) return "evening";
  return "night";
}
function useSky() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  let forced = null;
  try { forced = new URLSearchParams(window.location.search).get("sky"); } catch { /* ignore */ }
  const h = SKY_HOURS[forced] ?? now.getHours() + now.getMinutes() / 60;
  return { sky: skyOf(h), h };
}
// Sun (05:30-18:30) and moon (19:00-05:00) travel a low arc across the sky.
function bodyPos(h, sky) {
  const night = sky === "night";
  const t = night ? ((h >= 19 ? h - 19 : h + 5) / 10) : Math.min(1, Math.max(0, (h - 5.5) / 13));
  return { left: `${6 + 88 * t}%`, top: `${76 - 40 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))}%` };
}

export function Backdrop({ dim }) {
  const { sky, h } = useSky();
  return (
    <div className={"backdrop noprint" + (dim ? " dim" : "")} data-sky={sky} aria-hidden="true">
      {["morning", "day", "evening", "night"].map((s) => <div key={s} className={"sky " + s + (s === sky ? " on" : "")} />)}
      {sky === "night" ? <i className="moon" style={bodyPos(h, sky)} /> : <i className="sun" style={bodyPos(h, sky)} />}
      {sky !== "night" && <><i className="cloud c1" /><i className="cloud c2" /><i className="cloud c3" /></>}
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice" focusable="false">
        <g className="stars">{STARS.map(([x, y], i) => <circle key={i} className="star" style={{ animationDelay: `${(i % 7) * 0.6}s` }} cx={x} cy={y} r={i % 3 ? 1.4 : 2} />)}</g>
        <g className="map-layer">
        <path className="route" d={ROUTE} />
        <path className="route-glow" d={ROUTE} />
        <circle className="parcel" r="5">
          <animateMotion dur="14s" repeatCount="indefinite" path={ROUTE} />
        </circle>
        {CITIES.map((c) => (
          <g key={c.name}>
            <circle className="ping" cx={c.x} cy={c.y} r="6" />
            <circle className="node" cx={c.x} cy={c.y} r="6" />
            <text className="city" x={c.x} y={c.y - 16} textAnchor="middle">{c.name}</text>
          </g>
        ))}
        </g>
      </svg>
    </div>
  );
}

export default function Hero({ children, action, onMenu, menuOpen }) {
  const [logoOk, setLogoOk] = useState(true);
  const today = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <header className="hero noprint">
      <div className="hero-banner">
        {onMenu && (
          <button type="button" className="menu-btn" onClick={onMenu} aria-label="Menu" aria-expanded={!!menuOpen}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        )}
        <div className="brand">
          <div className="logo-tile">
            {logoOk ? (
              <img className="brand-logo" src="/logo.png" alt="Franch Express Courier logo" onError={() => setLogoOk(false)} />
            ) : (
              <svg className="parcel-mark" viewBox="0 0 56 56" fill="none" stroke="#0a1d36" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                <path d="M28 6 L48 16 V38 L28 48 L8 38 V16 Z" />
                <path d="M8 16 L28 26 L48 16" />
                <path d="M28 26 V48" />
                <path d="M18 11 L38 21" stroke="#f2a900" />
              </svg>
            )}
          </div>
          <div className="brand-text">
            <h1 className="brand-name">FRANCH EXPRESS COURIER</h1>
            <p className="eyebrow-light">Erode · Serving Tamil Nadu since 1987</p>
          </div>
        </div>
        <div className="hero-side">
          <span className="hero-section">Billing Entry</span>
          <span className="date-chip">{today}</span>
        </div>
        {action && <div className="hero-action">{action}</div>}
      </div>
      {children}
    </header>
  );
}

// Copyright line: sits below the last panel (screen only).
export function Foot() {
  return (
    <footer className="foot noprint">
      <p>© {new Date().getFullYear()} Franch Express Courier Pvt. Ltd. · Erode <span className="powered">· Powered by <b>RK</b></span></p>
    </footer>
  );
}

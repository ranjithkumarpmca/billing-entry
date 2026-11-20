import { useEffect, useState } from "react";
import { authLogin } from "./api.js";
import { playClick, playLock, playUnlock } from "./sound.js";

function greetingFor(d) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 20) return "Good evening";
  return "Good night";
}


// Dust specks drifting up behind the doors. Fixed values so every open looks the same.
const DUST = [
  { l: 8, d: 0, t: 11 }, { l: 18, d: 3, t: 14 }, { l: 27, d: 1.5, t: 9 }, { l: 38, d: 5, t: 13 },
  { l: 49, d: 2, t: 10 }, { l: 58, d: 6, t: 15 }, { l: 66, d: 0.5, t: 12 }, { l: 75, d: 4, t: 9.5 },
  { l: 84, d: 2.5, t: 14 }, { l: 93, d: 7, t: 11.5 }, { l: 13, d: 8, t: 13.5 }, { l: 71, d: 9, t: 10.5 },
];

// Background: a few stars (night only), and a parcel route Erode -> Salem -> Chennai with a truck driving it.
const STARS = [
  { l: 6, t: 8, d: 0 }, { l: 17, t: 22, d: 1.2 }, { l: 29, t: 6, d: 2.1 }, { l: 41, t: 18, d: 0.6 },
  { l: 53, t: 10, d: 2.8 }, { l: 64, t: 26, d: 1.7 }, { l: 76, t: 12, d: 3.4 }, { l: 88, t: 30, d: 0.9 },
  { l: 94, t: 6, d: 2.4 }, { l: 22, t: 40, d: 3.1 }, { l: 71, t: 44, d: 1.1 }, { l: 48, t: 36, d: 2.6 },
];
// Stops along the road at the bottom of the login screen (left % of the road).
const CITIES = [
  { left: "18%", n: "Erode" },
  { left: "50%", n: "Salem" },
  { left: "84%", n: "Chennai" },
];

// A small walking person (loaders and drivers). carry = holding a parcel.
function Walker({ cls, style, carry }) {
  return (
    <span className={"walker " + cls} style={style} aria-hidden="true">
      <svg viewBox="0 0 14 26">
        <circle cx="7" cy="4" r="3.5" />
        <path d="M3 9h8v8H3z" />
        <path d="M4.5 17l-1.5 8M9.5 17l1.5 8" stroke="#e8f0fb" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        {carry && <rect className="carry" x="9" y="11" width="7" height="6" rx="1" fill="#fff3d6" />}
      </svg>
    </span>
  );
}

// Two doors and a padlock, with one password box. Wrong password shakes the card and flashes the lock.
// stage: "idle" (closed, waiting) | "unlocking" (doors slide open) | "locking" (doors slide shut)
// role: ADMIN | BILLER (shown in the welcome line while unlocking). slow: idle lock, slower animation.
export default function LoginScreen({ stage, notice, onSignedIn, role, slow }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [jolt, setJolt] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [par, setPar] = useState({ x: 0, y: 0 });
  const [caps, setCaps] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [ok, setOk] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (stage === "idle") return undefined;
    if (stage === "unlocking") playUnlock();
    // Unlock: key reaches the keyhole about 0.56s in.
    // Lock: doors close first (0.9s), then the key goes in (about 1.42s), and the shackle snaps (about 1.45s).
    // Slow lock: the same, stretched.
    const locking = stage === "locking";
    const at = locking ? (slow ? 2470 : 1420) : 560;
    const timers = [
      setTimeout(() => { playClick(); setJolt(true); }, at),
      setTimeout(() => setJolt(false), at + 180),
    ];
    if (locking) timers.push(setTimeout(playLock, slow ? 2600 : 1450));
    return () => timers.forEach(clearTimeout);
  }, [stage, slow]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const submitLogin = async (e) => {
    e.preventDefault();
    if (busy || pin.length < 4) return;
    setBusy(true);
    setErr("");
    try {
      const r = await authLogin(pin);
      setOk(true);
      setTimeout(() => onSignedIn(r.role), 450);
    } catch (ex) {
      setPin("");
      setErr(ex.message);
      if (/too many/i.test(ex.message || "")) setLockUntil(Date.now() + 60000);
      setShake(true);
      setTimeout(() => setShake(false), 450);
    } finally {
      setBusy(false);
    }
  };

  const onTilt = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
  };
  const resetTilt = () => setTilt({ x: 0, y: 0 });
  const onScene = (e) => {
    if (stage !== "idle") return;
    setPar({ x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 });
  };
  const checkCaps = (e) => setCaps(Boolean(e.getModifierState && e.getModifierState("CapsLock")));

  const padlockOpen = stage === "unlocking";
  const lockLeft = lockUntil ? Math.max(0, Math.ceil((lockUntil - now.getTime()) / 1000)) : 0;
  const greeting = greetingFor(now);
  // When the lockout countdown ends, clear the old lockout message so nothing stale stays on screen.
  useEffect(() => {
    if (lockUntil && lockLeft === 0) {
      setLockUntil(0);
      setErr("");
    }
  }, [lockLeft, lockUntil]);
  const cardHidden = stage !== "idle";
  const tiltStyle = stage === "idle"
    ? { transform: `rotateX(${(-tilt.y * 14).toFixed(2)}deg) rotateY(${(tilt.x * 14).toFixed(2)}deg)` }
    : undefined;
  const welcome = role === "ADMIN" ? "Welcome, Admin" : role === "BILLER" ? "Welcome, Biller" : "Welcome";

  return (
    <div
      className={"auth-scene " + stage + (jolt ? " jolt" : "") + (stage === "locking" && slow ? " slow" : "")}
      role="dialog" aria-modal="true" aria-label="Sign in" onMouseMove={onScene}
    >
      <div className="auth-bg t-night" aria-hidden="true">
        <div className="auth-stars" style={{ transform: `translate3d(${(par.x * 10).toFixed(1)}px, ${(par.y * 6).toFixed(1)}px, 0)` }}>
          {STARS.map((s, i) => (
            <span key={i} style={{ left: s.l + "%", top: s.t + "%", animationDelay: s.d + "s" }} />
          ))}
        </div>
        <div className="auth-road" style={{ transform: `translate3d(${(-par.x * 16).toFixed(1)}px, ${(-par.y * 10).toFixed(1)}px, 0)` }}>
          <div className="auth-road-line" />
          {CITIES.map((c) => (
            <span key={c.n} className="auth-road-city" style={{ left: c.left }} />
          ))}
          {CITIES.map((c) => (
            <span key={c.n + "-name"} className="auth-road-name" style={{ left: c.left }}>{c.n}</span>
          ))}
          <Walker cls="walk-e" style={{ "--n": "58px" }} carry />
          <Walker cls="walk-f" style={{ "--n": "74px" }} />
          <Walker cls="walk-c1" style={{ "--n": "18px" }} carry />
          <Walker cls="walk-c2" style={{ "--n": "32px" }} />
          <span className="ground-parcel g2" />
          <svg className="auth-truck" viewBox="0 0 64 36" aria-hidden="true">
            <rect x="2" y="6" width="38" height="20" rx="3" fill="#f2a900" />
            <rect className="parcel-a" x="8" y="0" width="16" height="12" rx="2" fill="#fff3d6" />
            <rect className="parcel-y" x="25" y="2" width="12" height="10" rx="2" fill="#ffe9b0" />
            <path d="M42 12 H52 L62 22 V26 H42 Z" fill="#ffd45c" />
            <rect x="48" y="15" width="8" height="6" fill="#0a1d36" />
            <circle className="drv-head" cx="52" cy="17" r="2.8" fill="#ffd9a8" />
            <circle cx="12" cy="30" r="5" fill="#0a1d36" />
            <circle cx="50" cy="30" r="5" fill="#0a1d36" />
          </svg>
        </div>
      </div>
      <div className="auth-clock" aria-hidden="true">
        <p className="auth-time">{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
        <p className="auth-date">{now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
      </div>
      <div className="auth-dust" aria-hidden="true">
        {DUST.map((d, i) => (
          <span key={i} style={{ left: d.l + "%", animationDelay: d.d + "s", animationDuration: d.t + "s" }} />
        ))}
      </div>
      <div className="auth-door left" aria-hidden="true"><span className="auth-grip" /></div>
      <div className="auth-door right" aria-hidden="true"><span className="auth-grip" /></div>

      <div className="auth-stack">
        <div className={"auth-brand" + (cardHidden ? " hide" : "")}>
          <img src="/logo.png" alt="" className="auth-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
        <div className="auth-lock-wrap" onMouseMove={stage === "idle" ? onTilt : undefined} onMouseLeave={resetTilt} style={{ position: "relative", width: 84, height: 104, perspective: 700, transformStyle: "preserve-3d" }}>
          <svg
            className={"auth-padlock" + (padlockOpen ? " open" : "") + (shake ? " wrong" : "")}
            viewBox="0 0 64 80" aria-hidden="true" style={tiltStyle}
          >
            <defs>
              <clipPath id="authLockBody"><rect x="8" y="34" width="48" height="40" rx="7" /></clipPath>
              <linearGradient id="authShineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0.7" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="auth-shackle" d="M18 34 V22 a14 14 0 0 1 28 0 V34" fill="none" stroke="#f2a900" strokeWidth="6" strokeLinecap="round" />
            <rect x="8" y="34" width="48" height="40" rx="7" fill="#f2a900" />
            <g clipPath="url(#authLockBody)">
              <g transform="skewX(-18)">
                <rect className="auth-shine" x="-12" y="26" width="18" height="56" fill="url(#authShineGrad)" />
              </g>
            </g>
            <circle cx="32" cy="50" r="5" fill="#0a1d36" />
            <rect x="30" y="52" width="4" height="11" rx="2" fill="#0a1d36" />
          </svg>
          {ok && (
            <svg className="auth-tick" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="11" />
              <path d="M6.5 12.5l3.5 3.5 7.5-8" />
            </svg>
          )}
          <div className="lock-key" aria-hidden="true" style={{ position: "absolute", left: 22, top: -20, width: 40, height: 90, opacity: stage === "idle" ? 0 : undefined, pointerEvents: "none", transformOrigin: "50% 100%", transformStyle: "preserve-3d" }}>
          <svg className="key-edge" viewBox="0 0 40 90" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width: 40, height: 90, overflow: "visible", transform: "translateZ(1px)" }}>
              <rect x="17" y="28" width="6" height="50" rx="2" fill="url(#authKeyGold)" />
              <circle cx="20" cy="16" r="13" fill="none" stroke="url(#authKeyGold)" strokeWidth="6" />
              <rect x="23" y="62" width="6" height="5" fill="url(#authKeyGold)" />
              <rect x="23" y="70" width="9" height="5" fill="url(#authKeyGold)" />
              <rect x="17" y="78" width="6" height="12" fill="url(#authKeyGold)" />
          </svg>
          <svg className="key-edge" viewBox="0 0 40 90" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width: 40, height: 90, overflow: "visible", transform: "translateZ(0px)" }}>
              <rect x="17" y="28" width="6" height="50" rx="2" fill="url(#authKeyGold)" />
              <circle cx="20" cy="16" r="13" fill="none" stroke="url(#authKeyGold)" strokeWidth="6" />
              <rect x="23" y="62" width="6" height="5" fill="url(#authKeyGold)" />
              <rect x="23" y="70" width="9" height="5" fill="url(#authKeyGold)" />
              <rect x="17" y="78" width="6" height="12" fill="url(#authKeyGold)" />
          </svg>
          <svg className="key-edge" viewBox="0 0 40 90" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width: 40, height: 90, overflow: "visible", transform: "translateZ(-1px)" }}>
              <rect x="17" y="28" width="6" height="50" rx="2" fill="url(#authKeyGold)" />
              <circle cx="20" cy="16" r="13" fill="none" stroke="url(#authKeyGold)" strokeWidth="6" />
              <rect x="23" y="62" width="6" height="5" fill="url(#authKeyGold)" />
              <rect x="23" y="70" width="9" height="5" fill="url(#authKeyGold)" />
              <rect x="17" y="78" width="6" height="12" fill="url(#authKeyGold)" />
          </svg>
          <svg className="key-face key-front" viewBox="0 0 40 90" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width: 40, height: 90, overflow: "visible", transform: "translateZ(2px)" }}>
              <defs>
                <linearGradient id="authKeyGold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ffe08a" />
                  <stop offset="0.5" stopColor="#f2a900" />
                  <stop offset="1" stopColor="#a86f00" />
                </linearGradient>
              </defs>
              <rect x="17" y="28" width="6" height="50" rx="2" fill="url(#authKeyGold)" />
              <circle cx="20" cy="16" r="13" fill="none" stroke="url(#authKeyGold)" strokeWidth="6" />
              <rect x="23" y="62" width="6" height="5" fill="url(#authKeyGold)" />
              <rect x="23" y="70" width="9" height="5" fill="url(#authKeyGold)" />
              <rect x="17" y="78" width="6" height="12" fill="url(#authKeyGold)" />
          </svg>
          <svg className="key-face key-back" viewBox="0 0 40 90" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width: 40, height: 90, overflow: "visible", transform: "translateZ(-2px) rotateY(180deg)" }}>
              <rect x="17" y="28" width="6" height="50" rx="2" fill="url(#authKeyGold)" />
              <circle cx="20" cy="16" r="13" fill="none" stroke="url(#authKeyGold)" strokeWidth="6" />
              <rect x="23" y="62" width="6" height="5" fill="url(#authKeyGold)" />
              <rect x="23" y="70" width="9" height="5" fill="url(#authKeyGold)" />
              <rect x="17" y="78" width="6" height="12" fill="url(#authKeyGold)" />
          </svg>
          </div>
        </div>

        <div className={"auth-card" + (shake ? " shake" : "") + (cardHidden ? " hide" : "")}>
          <form onSubmit={submitLogin} className="auth-form">
            <p className="auth-greet">{greeting}</p>
            <p className="auth-title">Enter Password</p>
            <div className="auth-pin-wrap">
              <input
                id="pin" type={show ? "text" : "password"} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                autoFocus maxLength={8} value={pin} className={"auth-pin with-eye" + (caps ? " caps" : "")} aria-label="Password" onKeyDown={checkCaps} onKeyUp={checkCaps}
                onChange={(e) => setPin(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
              />
              <button type="button" className="auth-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                  {show && <path d="M3 3l18 18" />}
                </svg>
              </button>
            </div>
            <p className={"auth-caps" + (caps ? " on" : "")} aria-hidden="true">Caps Lock is on</p>
            <button className="primary auth-go" type="submit" disabled={busy || ok || pin.length < 4 || lockLeft > 0}>
              {busy ? "Checking…" : "Unlock"}
            </button>
            <p className={"auth-msg" + (err || lockLeft > 0 ? " err" : "")} role="status">{lockLeft > 0 ? `Too many wrong passwords. Try again in ${lockLeft}s` : (err || notice || " ")}</p>
          </form>
        </div>
      </div>

      {stage === "unlocking" && <p className="auth-welcome">{welcome}</p>}
    </div>
  );
}
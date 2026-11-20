import { useEffect, useRef, useState } from "react";
import EntryPage from "./EntryPage.jsx";
import RecordsPage from "./RecordsPage.jsx";
import CustomersPage from "./CustomersPage.jsx";
import DashboardPage from "./DashboardPage.jsx";
import LoginScreen from "./LoginScreen.jsx";
import { authLogout, authStatus, fetchCustomers } from "./api.js";
import Hero, { Backdrop, Foot } from "./Hero.jsx";

const IDLE_MS = 15 * 60 * 1000; // 15 minutes without a click, key or scroll locks the program
const LOCK_ANIM_MS = 2300;
const LOCK_ANIM_SLOW_MS = 3700; // idle lock is slower, like a door closing on its own
const UNLOCK_ANIM_MS = 2000;


// Sidebar icons (24px grid, stroke style).
const ICON = {
  plus: <path d="M12 5v14M5 12h14" />,
  dash: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <><path d="M9 6h12M9 12h12M9 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
};
function Ico({ name, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON[name]}
    </svg>
  );
}

export default function App() {
  // checking | locked | unlocking | open | locking
  const [phase, setPhase] = useState("checking");
  const [role, setRole] = useState(""); // ADMIN | BILLER
  const [notice, setNotice] = useState("");
  const [askLogout, setAskLogout] = useState(false);
  const [seq, setSeq] = useState(0); // remounts the door screen for each lock
  const [tab, setTab] = useState("entry");
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasRows, setHasRows] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [custState, setCustState] = useState("loading"); // loading | ready | error
  const [lockSlow, setLockSlow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // phone: sidebar drawer
  const [theme, setTheme] = useState("light"); // every login starts in light mode
  const [toast, setToast] = useState(null); // { id, msg }
  const lastActive = useRef(Date.now());

  const isAdmin = role === "ADMIN";
  const isDark = theme === "dark";

  // Colours follow data-theme on <html>: light or dark (the CSS holds both palettes).
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, [isDark]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const flash = (msg) => setToast({ id: Date.now(), msg });
  // Profile menu (top right): closes on outside click or Esc.
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  useEffect(() => {
    if (!profileOpen) return undefined;
    const onDown = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setProfileOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [profileOpen]);
  const go = (id) => { setTab(id); setMenuOpen(false); };
  const [billFor, setBillFor] = useState(null); // customer picked with "Create Bill" on the dashboard
  const createBillFor = (id) => { setBillFor({ id, at: Date.now() }); go("entry"); };

  const loadCustomers = async () => {
    setCustState("loading");
    try {
      setCustomers(await fetchCustomers());
      setCustState("ready");
    } catch {
      setCustState("error");
    }
  };

  // On open: is there already a live login?
  useEffect(() => {
    authStatus()
      .then((s) => {
        if (s.role) {
          setRole(s.role);
          setTab(s.role === "ADMIN" ? "dashboard" : "entry");
          loadCustomers();
          setPhase("open");
        } else {
          setPhase("locked");
        }
      })
      .catch(() => {
        setNotice("Cannot reach the program. Is it running?");
        setPhase("locked");
      });
  }, []);

  const enterApp = (r) => {
    setTheme("light");
    setRole(r);
    setTab(r === "ADMIN" ? "dashboard" : "entry"); // admin lands on the dashboard, billers on New entry
    loadCustomers();
    setPhase("unlocking");
    setTimeout(() => setPhase("open"), UNLOCK_ANIM_MS);
  };

  const lockNow = (msg = "", slow = false) => {
    setAskLogout(false);
    setMenuOpen(false);
    setNotice(msg);
    setSeq((n) => n + 1);
    setLockSlow(slow);
    setPhase("locking");
    setTimeout(() => {
      authLogout().catch(() => {}); // the server may already have ended the login
      setRole("");
      setPhase("locked");
    }, slow ? LOCK_ANIM_SLOW_MS : LOCK_ANIM_MS);
  };

  // Idle lock: any click, key, touch or scroll counts as activity.
  useEffect(() => {
    if (phase !== "open") return undefined;
    lastActive.current = Date.now();
    const bump = () => { lastActive.current = Date.now(); };
    const events = ["pointerdown", "keydown", "touchstart", "scroll", "input"];
    events.forEach((e) => window.addEventListener(e, bump, { capture: true, passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - lastActive.current > IDLE_MS) lockNow("Locked after 15 minutes without activity. Enter your password.", true);
    }, 15000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
      clearInterval(timer);
    };
  }, [phase]);

  // The server ended the login (idle or restart) while the app was open.
  useEffect(() => {
    const onLocked = () => { if (phase === "open") lockNow("Your session has ended. Enter your password."); };
    window.addEventListener("pod-locked", onLocked);
    return () => window.removeEventListener("pod-locked", onLocked);
  }, [phase]);

  const showApp = phase === "open" || phase === "unlocking" || phase === "locking";
  const stage = phase === "unlocking" ? "unlocking" : phase === "locking" ? "locking" : "idle";

  const nav = [
    ...(isAdmin ? [{ id: "dashboard", label: "Dashboard", icon: "dash" }] : []),
    { id: "entry", label: "New entry", icon: "plus" },
    { id: "records", label: "Records", icon: "list" },
    ...(isAdmin ? [{ id: "customers", label: "Add new customer", icon: "user" }] : []),
  ];

  return (
    <>
      <Backdrop dim={hasRows || tab !== "entry"} />
      {showApp && (
        <div className={"shell" + (menuOpen ? " menu-open" : "")}>
          <aside className="sidebar noprint" aria-label="Pages">
            <p className="side-title">Billing Entry</p>
            <nav className="side-nav">
              {nav.map((n) => (
                <button key={n.id} className={"side-link" + (tab === n.id ? " on" : "")} aria-current={tab === n.id ? "page" : undefined} onClick={() => go(n.id)}>
                  <Ico name={n.icon} />
                  <span>{n.label}</span>
                </button>
              ))}
            </nav>
          </aside>
          {menuOpen && <div className="side-scrim noprint" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

          <div className="app">
            <Hero
              onMenu={() => setMenuOpen((o) => !o)}
              menuOpen={menuOpen}
              action={
                <div className="hdr-actions">
                  <div className="seg-theme" role="radiogroup" aria-label="Theme">
                    <button type="button" role="radio" aria-checked={!isDark} className={"seg-opt" + (!isDark ? " on" : "")} onClick={() => setTheme("light")}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                      <span className="seg-label">Light</span>
                    </button>
                    <button type="button" role="radio" aria-checked={isDark} className={"seg-opt" + (isDark ? " on" : "")} onClick={() => setTheme("dark")}>
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
                      <span className="seg-label">Dark</span>
                    </button>
                  </div>
                  <div className="profile" ref={profileRef}>
                    <button type="button" className="profile-btn" aria-label="Account" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((o) => !o)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>
                    </button>
                    {profileOpen && (
                      <div className="profile-menu" role="menu">
                        <div className="profile-who">
                          <span className="profile-name">{isAdmin ? "Admin" : "Biller"}</span>
                          <span className="profile-role">Signed in</span>
                        </div>
                        <button type="button" role="menuitem" className="profile-item" onClick={() => { setProfileOpen(false); setAskLogout(true); }}>
                          Log out
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              }
            />

            {isAdmin && (
              <div hidden={tab !== "dashboard"} className="stack">
                <DashboardPage active={tab === "dashboard"} refreshKey={refreshKey} onNewBill={createBillFor} onAddCustomer={() => go("customers")} />
              </div>
            )}
            <div hidden={tab !== "entry"} className="stack">
              <EntryPage customers={customers} presetCustomer={billFor} onHasRows={setHasRows} onSaved={() => { setRefreshKey((k) => k + 1); flash("Saved ✓"); }}
                onOpenRecords={() => go("records")} onOpenCustomers={isAdmin ? () => go("customers") : undefined} />
            </div>
            <div hidden={tab !== "records"} className="stack">
              <RecordsPage active={tab === "records"} refreshKey={refreshKey} customers={customers} />
            </div>
            {isAdmin && (
              <div hidden={tab !== "customers"} className="stack">
                <CustomersPage customers={customers} state={custState} onChanged={() => { loadCustomers(); flash("Updated ✓"); }} />
              </div>
            )}
            <Foot />
          </div>
        </div>
      )}

      {toast && <div key={toast.id} className="toast" role="status">{toast.msg}</div>}

      {(phase === "locked" || phase === "unlocking" || phase === "locking") && (
        <LoginScreen key={seq} stage={stage} notice={notice} onSignedIn={enterApp} role={role} slow={lockSlow} />
      )}

      {askLogout && (
        <div className="auth-modal-back noprint">
          <div className="auth-modal" role="alertdialog" aria-modal="true" aria-labelledby="logout-q">
            <p id="logout-q">Are you sure you want to log out?</p>
            <div className="auth-modal-actions">
              <button className="ghost" onClick={() => setAskLogout(false)}>No</button>
              <button className="primary" onClick={() => lockNow("")}>Yes, log out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
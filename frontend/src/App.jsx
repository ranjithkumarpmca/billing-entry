import { useEffect, useRef, useState } from "react";
import EntryPage from "./EntryPage.jsx";
import RecordsPage from "./RecordsPage.jsx";
import CustomersPage from "./CustomersPage.jsx";
import LoginScreen from "./LoginScreen.jsx";
import { authLogout, authStatus, fetchCustomers } from "./api.js";
import Hero, { Backdrop, Foot } from "./Hero.jsx";

const IDLE_MS = 15 * 60 * 1000; // 15 minutes without a click, key or scroll locks the program
const LOCK_ANIM_MS = 1000;
const UNLOCK_ANIM_MS = 1200;

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
  const lastActive = useRef(Date.now());

  const isAdmin = role === "ADMIN";

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
    setRole(r);
    setTab("entry");
    loadCustomers();
    setPhase("unlocking");
    setTimeout(() => setPhase("open"), UNLOCK_ANIM_MS);
  };

  const lockNow = (msg = "") => {
    setAskLogout(false);
    setNotice(msg);
    setSeq((n) => n + 1);
    setPhase("locking");
    setTimeout(() => {
      authLogout().catch(() => {}); // the server may already have ended the login
      setRole("");
      setPhase("locked");
    }, LOCK_ANIM_MS);
  };

  // Idle lock: any click, key, touch or scroll counts as activity.
  useEffect(() => {
    if (phase !== "open") return undefined;
    lastActive.current = Date.now();
    const bump = () => { lastActive.current = Date.now(); };
    const events = ["pointerdown", "keydown", "touchstart", "scroll", "input"];
    events.forEach((e) => window.addEventListener(e, bump, { capture: true, passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - lastActive.current > IDLE_MS) lockNow("Locked after 15 minutes without activity. Enter your password.");
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

  return (
    <>
      <Backdrop dim={hasRows || tab !== "entry"} />
      {showApp && (
        <div className="app">
          <Hero action={<button className="hero-logout" title="Log out" aria-label="Log out" onClick={() => setAskLogout(true)}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg><span>Log out</span></button>}>
            <nav className="tabs noprint" aria-label="Pages">
              <button className={tab === "entry" ? "on" : ""} onClick={() => setTab("entry")}>New entry</button>
              <button className={tab === "records" ? "on" : ""} onClick={() => setTab("records")}>Records</button>
              {isAdmin && (
                <button className={tab === "customers" ? "on" : ""} onClick={() => setTab("customers")}>Add new customer</button>
              )}
            </nav>
          </Hero>

          <div hidden={tab !== "entry"} className="stack">
            <EntryPage customers={customers} onHasRows={setHasRows} onSaved={() => setRefreshKey((k) => k + 1)}
              onOpenRecords={() => setTab("records")} onOpenCustomers={isAdmin ? () => setTab("customers") : undefined} />
          </div>
          <div hidden={tab !== "records"} className="stack">
            <RecordsPage active={tab === "records"} refreshKey={refreshKey} customers={customers} />
          </div>
          {isAdmin && (
            <div hidden={tab !== "customers"} className="stack">
              <CustomersPage customers={customers} state={custState} onChanged={loadCustomers} />
            </div>
          )}
          <Foot />
        </div>
      )}

      {(phase === "locked" || phase === "unlocking" || phase === "locking") && (
        <LoginScreen key={seq} stage={stage} notice={notice} onSignedIn={enterApp} />
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
